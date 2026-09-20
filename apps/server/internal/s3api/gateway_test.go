package s3api

import (
	"bytes"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	miniocreds "github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

// startMinIO boots a MinIO container and returns its endpoint plus a client.
func startMinIO(t *testing.T) (string, *minio.Client) {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test (requires docker)")
	}

	ctx := t.Context()
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "quay.io/minio/minio:latest",
			ExposedPorts: []string{"9000/tcp"},
			Cmd:          []string{"server", "/data"},
			WaitingFor:   wait.ForHTTP("/minio/health/ready").WithPort("9000/tcp"),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("start minio: %v", err)
	}
	t.Cleanup(func() {
		_ = container.Terminate(t.Context())
	})

	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "9000")
	endpoint := host + ":" + port.Port()

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  miniocreds.NewStaticV4("minioadmin", "minioadmin", ""),
		Secure: false,
	})
	if err != nil {
		t.Fatalf("minio client: %v", err)
	}

	return endpoint, client
}

// TestGatewayEndToEnd walks the full path an S3 client takes: SigV4 auth →
// bucket mapping → s3_compatible connector → MinIO, covering PUT, GET,
// HEAD, LIST, DELETE and multipart through the gateway, plus rejection of
// bad signatures and foreign workspaces.
func TestGatewayEndToEnd(t *testing.T) {
	endpoint, mc := startMinIO(t)

	backing := "backing-" + strings.ToLower(randToken(4))
	ctx := t.Context()
	if err := mc.MakeBucket(ctx, backing, minio.MakeBucketOptions{}); err != nil {
		t.Fatalf("make backing bucket: %v", err)
	}

	wsID := uuid.Must(uuid.NewV7())
	repos := newFakeRepos()
	accessKey, secret := addAccessKey(t, repos, wsID)
	addS3BucketMapping(t, repos, wsID, "gateway-bucket", backing, endpoint)

	base := startGateway(t, repos)
	client, err := minio.New(base, &minio.Options{
		Creds:  miniocreds.NewStaticV4(accessKey, secret, ""),
		Secure: false,
		// Path-style against the gateway: MinIO's SDK needs the bucket
		// lookup disabled so it does not probe for virtual-host support.
		BucketLookup: minio.BucketLookupPath,
	})
	if err != nil {
		t.Fatalf("gateway client: %v", err)
	}

	// --- PutObject ---
	payload := randBytes(1 << 20) // 1 MiB
	uploadInfo, err := client.PutObject(ctx, "gateway-bucket", "docs/hello.txt", bytes.NewReader(payload), int64(len(payload)), minio.PutObjectOptions{})
	if err != nil {
		t.Fatalf("PutObject: %v", err)
	}
	if uploadInfo.ETag == "" {
		t.Fatal("empty etag")
	}

	// --- StatObject / GetObject roundtrip ---
	info, err := client.StatObject(ctx, "gateway-bucket", "docs/hello.txt", minio.StatObjectOptions{})
	if err != nil {
		t.Fatalf("StatObject: %v", err)
	}
	if info.Size != int64(len(payload)) {
		t.Fatalf("size mismatch: got %d want %d", info.Size, len(payload))
	}

	obj, err := client.GetObject(ctx, "gateway-bucket", "docs/hello.txt", minio.GetObjectOptions{})
	if err != nil {
		t.Fatalf("GetObject: %v", err)
	}
	got, err := io.ReadAll(obj)
	obj.Close()
	if err != nil {
		t.Fatalf("read object: %v", err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatal("roundtrip content mismatch")
	}

	// --- ListObjectsV2 ---
	for _, key := range []string{"docs/a.txt", "docs/sub/b.txt", "other/c.txt"} {
		if _, err := client.PutObject(ctx, "gateway-bucket", key, strings.NewReader("x"), 1, minio.PutObjectOptions{}); err != nil {
			t.Fatalf("PutObject %s: %v", key, err)
		}
	}

	listCh := client.ListObjects(ctx, "gateway-bucket", minio.ListObjectsOptions{
		Prefix:    "docs/",
		Recursive: true,
	})
	count := 0
	for o := range listCh {
		if o.Err != nil {
			t.Fatalf("list: %v", o.Err)
		}
		count++
	}
	if count != 3 {
		t.Fatalf("expected 3 objects under docs/, got %d", count)
	}

	// --- Multipart upload through the gateway ---
	core := &minio.Core{Client: client}
	uploadID, err := core.NewMultipartUpload(ctx, "gateway-bucket", "big/video.mp4", minio.PutObjectOptions{})
	if err != nil {
		t.Fatalf("NewMultipartUpload: %v", err)
	}

	part1 := randBytes(5 << 20) // 5 MiB, minimum part size
	part2 := randBytes(3 << 20)
	p1, err := core.PutObjectPart(ctx, "gateway-bucket", "big/video.mp4", uploadID, 1, bytes.NewReader(part1), int64(len(part1)), minio.PutObjectPartOptions{})
	if err != nil {
		t.Fatalf("PutObjectPart 1: %v", err)
	}
	p2, err := core.PutObjectPart(ctx, "gateway-bucket", "big/video.mp4", uploadID, 2, bytes.NewReader(part2), int64(len(part2)), minio.PutObjectPartOptions{})
	if err != nil {
		t.Fatalf("PutObjectPart 2: %v", err)
	}

	_, err = core.CompleteMultipartUpload(ctx, "gateway-bucket", "big/video.mp4", uploadID, []minio.CompletePart{
		{PartNumber: 1, ETag: p1.ETag},
		{PartNumber: 2, ETag: p2.ETag},
	}, minio.PutObjectOptions{})
	if err != nil {
		t.Fatalf("CompleteMultipartUpload: %v", err)
	}

	mpObj, err := client.GetObject(ctx, "gateway-bucket", "big/video.mp4", minio.GetObjectOptions{})
	if err != nil {
		t.Fatalf("Get multipart object: %v", err)
	}
	joined, err := io.ReadAll(mpObj)
	mpObj.Close()
	if err != nil {
		t.Fatalf("read multipart object: %v", err)
	}
	if len(joined) != len(part1)+len(part2) {
		t.Fatalf("multipart size mismatch: got %d want %d", len(joined), len(part1)+len(part2))
	}

	// --- ListBuckets ---
	buckets, err := client.ListBuckets(ctx)
	if err != nil {
		t.Fatalf("ListBuckets: %v", err)
	}
	found := false
	for _, b := range buckets {
		if b.Name == "gateway-bucket" {
			found = true
		}
	}
	if !found {
		t.Fatal("gateway-bucket missing from ListBuckets")
	}

	// --- DeleteObject (idempotent) ---
	if err := client.RemoveObject(ctx, "gateway-bucket", "docs/a.txt", minio.RemoveObjectOptions{}); err != nil {
		t.Fatalf("RemoveObject: %v", err)
	}

	// --- Auth failures ---

	// Wrong secret.
	badClient, _ := minio.New(base, &minio.Options{
		Creds: miniocreds.NewStaticV4(accessKey, "wrong-secret", ""), Secure: false,
		BucketLookup: minio.BucketLookupPath,
	})
	if _, err := badClient.ListBuckets(ctx); err == nil {
		t.Fatal("expected auth failure with wrong secret")
	}

	// Unknown access key.
	unknownClient, _ := minio.New(base, &minio.Options{
		Creds: miniocreds.NewStaticV4("CRUNKNOWNKEYID", secret, ""), Secure: false,
		BucketLookup: minio.BucketLookupPath,
	})
	if _, err := unknownClient.ListBuckets(ctx); err == nil {
		t.Fatal("expected auth failure with unknown access key")
	}

	// Foreign workspace cannot see the bucket.
	otherWS := uuid.Must(uuid.NewV7())
	otherKey, otherSecret := addAccessKey(t, repos, otherWS)
	foreignClient, _ := minio.New(base, &minio.Options{
		Creds: miniocreds.NewStaticV4(otherKey, otherSecret, ""), Secure: false,
		BucketLookup: minio.BucketLookupPath,
	})
	if _, err := foreignClient.StatObject(ctx, "gateway-bucket", "docs/hello.txt", minio.StatObjectOptions{}); err == nil {
		t.Fatal("expected access denied for foreign workspace")
	}

	// last_used_at was touched by successful requests.
	if !repos.touched[repos.credentials[accessKey].ID] {
		t.Fatal("credential last-used not recorded")
	}

	_ = time.Now // keep time import if assertions above change
}
