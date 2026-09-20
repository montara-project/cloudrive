package s3api

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log/slog"
	"net"
	"os"
	"strings"
	"sync"
	"testing"

	"cloudrive/server/internal/connectors"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// fakeRepos implements the gateway's Repos interface against in-memory maps,
// backed by one real MinIO bucket as the storage account behind the mapping.
type fakeRepos struct {
	mu          sync.Mutex
	credentials map[string]*models.S3Credential
	secrets     map[uuid.UUID][]byte
	buckets     map[string]*models.S3Bucket
	accounts    map[uuid.UUID]*models.StorageAccount
	providers   map[uuid.UUID]*models.Provider
	credsJSON   map[uuid.UUID]string
	touched     map[uuid.UUID]bool
}

func newFakeRepos() *fakeRepos {
	return &fakeRepos{
		credentials: map[string]*models.S3Credential{},
		secrets:     map[uuid.UUID][]byte{},
		buckets:     map[string]*models.S3Bucket{},
		accounts:    map[uuid.UUID]*models.StorageAccount{},
		providers:   map[uuid.UUID]*models.Provider{},
		credsJSON:   map[uuid.UUID]string{},
		touched:     map[uuid.UUID]bool{},
	}
}

func (f *fakeRepos) S3CredentialByAccessKey(accessKeyID string) (*models.S3Credential, []byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.credentials[accessKeyID]
	if !ok {
		return nil, nil, fmt.Errorf("not found")
	}
	return c, f.secrets[c.ID], nil
}

func (f *fakeRepos) S3CredentialTouch(id uuid.UUID) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.touched[id] = true
}

func (f *fakeRepos) BucketByName(name string) (*models.S3Bucket, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	b, ok := f.buckets[name]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return b, nil
}

func (f *fakeRepos) BucketsByWorkspace(wsID uuid.UUID) ([]*models.S3Bucket, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []*models.S3Bucket
	for _, b := range f.buckets {
		if b.WorkspaceID == wsID {
			out = append(out, b)
		}
	}
	return out, nil
}

func (f *fakeRepos) StorageAccountWithProvider(id uuid.UUID) (*models.StorageAccount, *models.Provider, string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	a, ok := f.accounts[id]
	if !ok {
		return nil, nil, "", fmt.Errorf("not found")
	}
	return a, f.providers[a.ProviderID], f.credsJSON[a.ID], nil
}

// randToken returns a URL-safe random string.
func randToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return strings.TrimRight(base64.RawURLEncoding.EncodeToString(b), "=")
}

func randBytes(n int) []byte {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return b
}

// startGateway builds the gateway Fiber app with the given repos and serves
// it on a random local port. Returns the base URL.
func startGateway(t *testing.T, repos *fakeRepos) string {
	t.Helper()

	app := fiber.New(fiber.Config{
		BodyLimit:         5 * 1024 * 1024 * 1024, // mirror the production gateway
		StreamRequestBody: true,
	})
	Register(app, &Service{
		Repos: repos,
		Registry: connectors.Registry{
			StagingDir: t.TempDir(),
		},
		Logger: slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})),
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	go func() { _ = app.Listener(ln) }()

	t.Cleanup(func() { _ = app.Shutdown() })

	return "http://" + ln.Addr().String()
}

func addAccessKey(t *testing.T, repos *fakeRepos, wsID uuid.UUID) (string, string) {
	t.Helper()

	accessKeyID := "CRTEST" + strings.ToUpper(randToken(6))
	secret := randToken(32)
	id := uuid.Must(uuid.NewV7())

	repos.mu.Lock()
	repos.credentials[accessKeyID] = &models.S3Credential{
		ID: id, WorkspaceID: wsID, AccessKeyID: accessKeyID, Status: "active",
	}
	repos.secrets[id] = []byte(secret)
	repos.mu.Unlock()

	return accessKeyID, secret
}

// addS3BucketMapping wires a gateway bucket name to a real MinIO bucket via
// an s3_compatible storage account.
func addS3BucketMapping(t *testing.T, repos *fakeRepos, wsID uuid.UUID, name, backingBucket, endpoint string) *models.S3Bucket {
	t.Helper()

	providerID := uuid.Must(uuid.NewV7())
	accountID := uuid.Must(uuid.NewV7())

	repos.mu.Lock()
	repos.providers[providerID] = &models.Provider{ID: providerID, Protocol: "s3_compatible", AuthType: "access_key"}
	repos.accounts[accountID] = &models.StorageAccount{
		ID: accountID, WorkspaceID: wsID, ProviderID: providerID, Status: "active",
	}
	repos.credsJSON[accountID] = fmt.Sprintf(
		`{"endpoint": %q, "access_key_id": "minioadmin", "secret_access_key": "minioadmin", "bucket": %q, "secure": false}`,
		endpoint, backingBucket,
	)
	bucket := &models.S3Bucket{ID: uuid.Must(uuid.NewV7()), WorkspaceID: wsID, Name: name, StorageAccountID: accountID}
	repos.buckets[name] = bucket
	repos.mu.Unlock()

	return bucket
}

var _ = connectors.CompletedPart{}
var _ = context.Background
var _ = bytes.MinRead
