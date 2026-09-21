// Package connectors abstracts the backed storage behind the S3 gateway: one
// Connector per connected storage account, selected by the provider's
// protocol. Implementations translate the S3-shaped operations into the
// provider's native API (S3 proxy, Google Drive REST, ...).
package connectors

import (
	"context"
	"errors"
	"io"
	"time"
)

// ErrNotSupported is returned by connectors that cannot implement an
// operation on the backing provider (e.g. multipart passthrough on OAuth
// drives). The gateway maps it to S3 error responses.
var ErrNotSupported = errors.New("operation not supported by this provider")

// Object is the metadata the gateway needs to render S3 responses.
type Object struct {
	Key          string
	Size         int64
	ETag         string
	ContentType  string
	LastModified time.Time
}

// ListPage is one page of ListObjects results.
type ListPage struct {
	Objects              []Object
	// CommonPrefixes holds "directory" prefixes when a delimiter is used.
	CommonPrefixes       []string
	IsTruncated          bool
	NextContinuationToken string
}

// MultipartInfo describes a created multipart upload.
type MultipartInfo struct {
	UploadID string
}

// CompletedPart is one uploaded part in a CompleteMultipartUpload call.
type CompletedPart struct {
	PartNumber int
	ETag       string
}

// Connector performs object operations against one connected storage account.
// Implementations are created through the Registry, which supplies decrypted
// credentials; they never touch the database.
type Connector interface {
	PutObject(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Object, error)
	GetObject(ctx context.Context, key string) (io.ReadCloser, Object, error)
	StatObject(ctx context.Context, key string) (Object, error)
	DeleteObject(ctx context.Context, key string) error
	ListObjects(ctx context.Context, prefix, delimiter, continuationToken string, maxKeys int) (ListPage, error)

	CreateMultipartUpload(ctx context.Context, key, contentType string) (MultipartInfo, error)
	UploadPart(ctx context.Context, key, uploadID string, partNumber int, r io.Reader, size int64) (string, error)
	CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []CompletedPart) (Object, error)
	AbortMultipartUpload(ctx context.Context, key, uploadID string) error
}
