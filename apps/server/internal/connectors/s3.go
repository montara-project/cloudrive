package connectors

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"braces.dev/errtrace"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// s3Connector proxies object operations to any S3-compatible endpoint (AWS S3,
// MinIO, Wasabi, Cloudflare R2, ...) using the connected account's access key.
// Multipart uploads are passed through, so no staging is needed on this
// backend.
type s3Connector struct {
	core       *minio.Core
	client     *minio.Client
	bucket     string
	rootPrefix string
}

func newS3Connector(account AccountInput, creds Credentials) (*s3Connector, error) {
	endpoint := creds.string("endpoint")
	accessKey := creds.string("access_key_id")
	secretKey := creds.string("secret_access_key")
	bucket := creds.string("bucket")
	if endpoint == "" || accessKey == "" || secretKey == "" {
		return nil, fmt.Errorf("s3_compatible account %s requires endpoint, access_key_id and secret_access_key credentials", account.ID)
	}

	// Settings may override the region and TLS behaviour for self-hosted
	// endpoints (e.g. MinIO on plain HTTP inside a private network).
	region := creds.string("region")
	// TLS is on unless the credentials explicitly opt out (self-hosted
	// MinIO on plain HTTP); settings may override below.
	secure := true
	if _, present := creds["secure"]; present {
		secure = creds.bool("secure")
	}
	tlsSkipVerify := creds.bool("tls_skip_verify")

	if len(account.Settings) > 0 {
		var settings struct {
			Bucket        *string `json:"bucket"`
			RootPrefix    string  `json:"root_prefix"`
			Region        *string `json:"region"`
			Secure        *bool   `json:"secure"`
			TLSSkipVerify *bool   `json:"tls_skip_verify"`
		}
		if err := json.Unmarshal(account.Settings, &settings); err == nil {
			if settings.Bucket != nil && *settings.Bucket != "" {
				bucket = *settings.Bucket
			}
			if settings.Region != nil && *settings.Region != "" {
				region = *settings.Region
			}
			if settings.Secure != nil {
				secure = *settings.Secure
			}
			if settings.TLSSkipVerify != nil {
				tlsSkipVerify = *settings.TLSSkipVerify
			}
		}
	}

	if bucket == "" {
		return nil, fmt.Errorf("s3_compatible account %s requires a bucket (credentials or settings)", account.ID)
	}

	opts := &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: secure,
		Region: region,
	}

	if tlsSkipVerify {
		opts.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // opt-in for self-hosted endpoints
		}
	}

	client, err := minio.New(endpoint, opts)
	if err != nil {
		return nil, errtrace.Wrap(err)
	}

	return &s3Connector{
		core:       &minio.Core{Client: client},
		client:     client,
		bucket:     bucket,
		rootPrefix: rootPrefixFrom(account),
	}, nil
}

func rootPrefixFrom(account AccountInput) string {
	if len(account.Settings) == 0 {
		return ""
	}

	var settings struct {
		RootPrefix string `json:"root_prefix"`
	}
	if err := json.Unmarshal(account.Settings, &settings); err != nil {
		return ""
	}

	return settings.RootPrefix
}

// fullKey joins the root prefix with the gateway object key.
func (c *s3Connector) fullKey(key string) string {
	return c.rootPrefix + key
}

// stripKey removes the root prefix from a backing key so gateway responses
// never leak it.
func (c *s3Connector) stripKey(key string) string {
	return strings.TrimPrefix(key, c.rootPrefix)
}

func toObject(info minio.ObjectInfo) Object {
	etag := strings.Trim(info.ETag, `"`)
	return Object{
		Key:          info.Key,
		Size:         info.Size,
		ETag:         etag,
		ContentType:  info.ContentType,
		LastModified: info.LastModified,
	}
}

func (c *s3Connector) PutObject(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Object, error) {
	info, err := c.core.PutObject(ctx, c.bucket, c.fullKey(key), r, size, "", "", minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	return Object{
		Key:          key,
		Size:         info.Size,
		ETag:         strings.Trim(info.ETag, `"`),
		ContentType:  contentType,
		LastModified: time.Now(),
	}, nil
}

func (c *s3Connector) GetObject(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	reader, info, _, err := c.core.GetObject(ctx, c.bucket, c.fullKey(key), minio.GetObjectOptions{})
	if err != nil {
		return nil, Object{}, errtrace.Wrap(err)
	}

	return reader, toObject(info), nil
}

func (c *s3Connector) StatObject(ctx context.Context, key string) (Object, error) {
	info, err := c.core.Client.StatObject(ctx, c.bucket, c.fullKey(key), minio.StatObjectOptions{})
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	return toObject(info), nil
}

func (c *s3Connector) DeleteObject(ctx context.Context, key string) error {
	return errtrace.Wrap(c.core.Client.RemoveObject(ctx, c.bucket, c.fullKey(key), minio.RemoveObjectOptions{}))
}

func (c *s3Connector) ListObjects(ctx context.Context, prefix, delimiter, continuationToken string, maxKeys int) (ListPage, error) {
	if maxKeys <= 0 {
		maxKeys = 1000
	}

	result, err := c.core.ListObjectsV2(c.bucket, c.fullPrefix(prefix), "", continuationToken, delimiter, maxKeys)
	if err != nil {
		return ListPage{}, errtrace.Wrap(err)
	}

	page := ListPage{
		IsTruncated:           result.IsTruncated,
		NextContinuationToken: result.NextContinuationToken,
	}

	for _, info := range result.Contents {
		page.Objects = append(page.Objects, Object{
			Key:          c.stripKey(info.Key),
			Size:         info.Size,
			ETag:         strings.Trim(info.ETag, `"`),
			ContentType:  info.ContentType,
			LastModified: info.LastModified,
		})
	}

	for _, cp := range result.CommonPrefixes {
		page.CommonPrefixes = append(page.CommonPrefixes, c.stripKey(cp.Prefix))
	}

	return page, nil
}

// fullPrefix joins the root prefix with the requested listing prefix.
func (c *s3Connector) fullPrefix(prefix string) string {
	return c.rootPrefix + prefix
}

func (c *s3Connector) CreateMultipartUpload(ctx context.Context, key, contentType string) (MultipartInfo, error) {
	uploadID, err := c.core.NewMultipartUpload(ctx, c.bucket, c.fullKey(key), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}

	return MultipartInfo{UploadID: uploadID}, nil
}

func (c *s3Connector) UploadPart(ctx context.Context, key, uploadID string, partNumber int, r io.Reader, size int64) (string, error) {
	part, err := c.core.PutObjectPart(ctx, c.bucket, c.fullKey(key), uploadID, partNumber, r, size, minio.PutObjectPartOptions{})
	if err != nil {
		return "", errtrace.Wrap(err)
	}

	return strings.Trim(part.ETag, `"`), nil
}

func (c *s3Connector) CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []CompletedPart) (Object, error) {
	complete := make([]minio.CompletePart, 0, len(parts))
	for _, p := range parts {
		complete = append(complete, minio.CompletePart{PartNumber: p.PartNumber, ETag: p.ETag})
	}

	info, err := c.core.CompleteMultipartUpload(ctx, c.bucket, c.fullKey(key), uploadID, complete, minio.PutObjectOptions{})
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	return Object{
		Key:          key,
		Size:         info.Size,
		ETag:         strings.Trim(info.ETag, `"`),
		LastModified: time.Now(),
	}, nil
}

func (c *s3Connector) AbortMultipartUpload(ctx context.Context, key, uploadID string) error {
	return errtrace.Wrap(c.core.AbortMultipartUpload(ctx, c.bucket, c.fullKey(key), uploadID))
}
