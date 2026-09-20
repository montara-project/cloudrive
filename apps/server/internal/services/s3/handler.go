package s3

import (
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"cloudrive/server/internal/connectors"
	"cloudrive/server/internal/lib/sigv4"
	"cloudrive/server/internal/models"

	"braces.dev/errtrace"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// Service wires the gateway to the repositories and connector registry.
type Service struct {
	Repos    Repos
	Registry connectors.Registry
	// Logger receives internal errors before they are collapsed into the
	// generic XML response; nil disables logging.
	Logger *slog.Logger
}

// Repos is the subset of the repository layer the gateway needs.
type Repos interface {
	// S3CredentialByAccessKey returns the active credential row and its
	// decrypted secret for signature verification.
	S3CredentialByAccessKey(accessKeyID string) (*models.S3Credential, []byte, error)
	// S3CredentialTouch records last-used time; failures are ignored.
	S3CredentialTouch(id uuid.UUID)
	// BucketByName resolves a bucket mapping (global namespace).
	BucketByName(name string) (*models.S3Bucket, error)
	// BucketsByWorkspace lists the bucket mappings of one workspace.
	BucketsByWorkspace(workspaceID uuid.UUID) ([]*models.S3Bucket, error)
	// StorageAccountWithProvider loads the account, its provider catalog row,
	// and the decrypted credentials JSON for connector construction.
	StorageAccountWithProvider(id uuid.UUID) (*models.StorageAccount, *models.Provider, string, error)
}

type handler struct {
	service *Service
}

// Register mounts the S3 routes on a dedicated Fiber app. Path-style only:
// the first path segment is the bucket, the rest is the object key.
func Register(app *fiber.App, service *Service) {
	h := &handler{service: service}

	app.All("/", h.listBuckets)
	app.All("/*", h.dispatch)
}

// dispatch routes a path-style request. The bucket is the first path
// segment; the key is everything after it with the original encoding.
func (h *handler) dispatch(c fiber.Ctx) error {
	credential, err := h.authenticate(c)
	if err != nil {
		return h.sendError(c, err)
	}

	path := c.Path() // starts with "/"
	trimmed := strings.TrimPrefix(path, "/")

	bucket := trimmed
	key := ""
	if i := strings.Index(trimmed, "/"); i >= 0 {
		bucket = trimmed[:i]
		key = trimmed[i+1:]
	}

	if key == "" {
		return h.bucketOps(c, credential, bucket)
	}
	return h.objectOps(c, credential, bucket, key)
}

// authenticate verifies the SigV4 signature against the decrypted secret of
// the access key named in the request. Presigned requests carry the
// signature in the query string; header-signed ones in Authorization.
func (h *handler) authenticate(c fiber.Ctx) (*models.S3Credential, error) {
	req := rebuildRequest(c)

	// First pass extracts the access key id (secret unused yet).
	res, err := sigv4.Verify(req, []byte{})
	if err != nil && !errors.Is(err, sigv4.ErrSignatureMismatch) {
		return nil, err
	}

	credential, secret, err := h.service.Repos.S3CredentialByAccessKey(res.AccessKeyID)
	if err != nil {
		return nil, errInvalidAccessKey
	}

	if _, err := sigv4.Verify(rebuildRequest(c), secret); err != nil {
		return nil, err
	}

	h.service.Repos.S3CredentialTouch(credential.ID)
	return credential, nil
}

// rebuildRequest materializes the incoming Fiber request as a net/http
// request for the SigV4 verifier: method, raw target, Host and headers.
func rebuildRequest(c fiber.Ctx) *http.Request {
	rawTarget := string(c.Request().Header.RequestURI())
	if rawTarget == "" {
		rawTarget = c.Path()
		if q := string(c.Request().URI().QueryString()); q != "" {
			rawTarget += "?" + q
		}
	}

	req, err := http.NewRequest(string(c.Method()), "http://sigv4-internal"+rawTarget, nil)
	if err != nil {
		// Malformed target: an empty request makes the verifier reject it.
		req = &http.Request{Method: string(c.Method()), URL: &url.URL{Path: "/"}, Header: http.Header{}}
	}

	c.Request().Header.VisitAll(func(k, v []byte) {
		req.Header.Add(string(k), string(v))
	})
	if host := string(c.Request().Header.Host()); host != "" {
		req.Host = host
		if req.Header.Get("Host") == "" {
			req.Header.Set("Host", host)
		}
	}

	return req
}

// connectorFor resolves bucket → storage account → provider → connector with
// freshly decrypted credentials, enforcing that the signed credential's
// workspace owns the bucket and the backing account is active.
func (h *handler) connectorFor(credential *models.S3Credential, bucketName string) (connectors.Connector, *models.S3Bucket, error) {
	bucket, err := h.service.Repos.BucketByName(bucketName)
	if err != nil {
		return nil, nil, errNoSuchBucket
	}

	if bucket.WorkspaceID != credential.WorkspaceID {
		return nil, nil, errAccessDenied
	}

	account, provider, credsJSON, err := h.service.Repos.StorageAccountWithProvider(bucket.StorageAccountID)
	if err != nil {
		return nil, nil, errAccessDenied
	}

	if account.Status != "active" {
		return nil, nil, errAccessDenied
	}

	conn, err := h.service.Registry.New(
		connectors.AccountInput{ID: account.ID, Settings: account.Settings},
		provider,
		credsJSON,
	)
	if err != nil {
		return nil, nil, errAccessDenied
	}

	return conn, bucket, nil
}

// --- ListBuckets (GET /) ---

func (h *handler) listBuckets(c fiber.Ctx) error {
	credential, err := h.authenticate(c)
	if err != nil {
		return h.sendError(c, err)
	}

	all, err := h.service.Repos.BucketsByWorkspace(credential.WorkspaceID)
	if err != nil {
		return h.sendError(c, err)
	}

	result := listAllMyBucketsResult{
		Xmlns: "http://s3.amazonaws.com/doc/2006-03-01/",
		Owner: owner{ID: credential.WorkspaceID.String(), DisplayName: credential.AccessKeyID},
	}
	for _, b := range all {
		result.Buckets = append(result.Buckets, bucketX{Name: b.Name, CreationDate: b.CreatedAt})
	}

	return h.sendXML(c, 200, result)
}

// --- bucket operations (GET/PUT/DELETE/HEAD /{bucket}) ---

func (h *handler) bucketOps(c fiber.Ctx, credential *models.S3Credential, bucket string) error {
	switch string(c.Method()) {
	case http.MethodGet:
		if len(c.Request().URI().QueryString()) > 0 && c.Query("uploads") != "" {
			return h.listMultipartUploadsStub(c, credential, bucket)
		}
		return h.listObjects(c, credential, bucket)
	case http.MethodPut:
		// Bucket creation is a management-API concern; accept-but-report for
		// clients that probe bucket existence.
		return h.sendError(c, errAccessDenied)
	case http.MethodHead:
		if _, _, err := h.connectorFor(credential, bucket); err != nil {
			return h.sendError(c, err)
		}
		return c.SendStatus(200)
	case http.MethodDelete:
		return h.sendError(c, errAccessDenied)
	default:
		return h.sendError(c, errNotImplemented)
	}
}

func (h *handler) listObjects(c fiber.Ctx, credential *models.S3Credential, bucketName string) error {
	conn, bucket, err := h.connectorFor(credential, bucketName)
	if err != nil {
		return h.sendError(c, err)
	}

	prefix := c.Query("prefix")
	delimiter := c.Query("delimiter")
	continuation := c.Query("continuation-token")
	maxKeys, err := strconv.Atoi(c.Query("max-keys"))
	if err != nil || maxKeys <= 0 {
		maxKeys = 1000
	}

	ctx, cancel := context.WithTimeout(c.Context(), 30*time.Second)
	defer cancel()

	page, err := conn.ListObjects(ctx, prefix, delimiter, continuation, maxKeys)
	if err != nil {
		return h.sendError(c, errtrace.Wrap(err))
	}

	result := listBucketResult{
		Name:                  bucket.Name,
		Prefix:                prefix,
		Delimiter:             delimiter,
		MaxKeys:               maxKeys,
		IsTruncated:           page.IsTruncated,
		ContinuationToken:     continuation,
		NextContinuationToken: page.NextContinuationToken,
	}
	for _, o := range page.Objects {
		result.Contents = append(result.Contents, objectX{
			Key: o.Key, Size: o.Size, ETag: `"` + o.ETag + `"`,
			StorageClass: "STANDARD", LastModified: o.LastModified,
		})
		result.KeyCount++
	}
	for _, p := range page.CommonPrefixes {
		result.CommonPrefixes = append(result.CommonPrefixes, prefixX{Prefix: p})
		result.KeyCount++
	}

	return h.sendXML(c, 200, result)
}

// listMultipartUploadsStub answers POST ?uploads-style discovery with an
// empty list: staging-based multipart state lives per connector instance, so
// cross-request upload discovery is not implemented for v1.
func (h *handler) listMultipartUploadsStub(c fiber.Ctx, credential *models.S3Credential, bucketName string) error {
	if _, _, err := h.connectorFor(credential, bucketName); err != nil {
		return h.sendError(c, err)
	}

	return h.sendXML(c, 200, struct {
		XMLName xml.Name `xml:"ListMultipartUploadsResult"`
		Bucket  string   `xml:"Bucket"`
	}{Bucket: bucketName})
}

// --- object operations ---

func (h *handler) objectOps(c fiber.Ctx, credential *models.S3Credential, bucketName, key string) error {
	if key == "" {
		return h.sendError(c, errNotImplemented)
	}

	// hasQuery reports whether the parameter is present, even with an empty
	// value ("?uploads" has no "=").
	hasQuery := func(name string) bool {
		return c.Request().URI().QueryArgs().Has(name)
	}

	// Multipart query parameters take precedence.
	if hasQuery("uploadId") || hasQuery("uploads") {
		return h.multipartOps(c, credential, bucketName, key)
	}

	switch string(c.Method()) {
	case http.MethodGet, http.MethodHead:
		return h.getObject(c, credential, bucketName, key)
	case http.MethodPut:
		return h.putObject(c, credential, bucketName, key)
	case http.MethodDelete:
		return h.deleteObject(c, credential, bucketName, key)
	default:
		return h.sendError(c, errNotImplemented)
	}
}

func (h *handler) getObject(c fiber.Ctx, credential *models.S3Credential, bucketName, key string) error {
	conn, _, err := h.connectorFor(credential, bucketName)
	if err != nil {
		return h.sendError(c, err)
	}

	// The response body streams after this handler returns, so the context
	// must not be cancelled when the handler finishes.
	ctx := context.WithoutCancel(c.Context())

	if string(c.Method()) == http.MethodHead {
		obj, err := conn.StatObject(ctx, key)
		if err != nil {
			return h.sendError(c, errNoSuchKey)
		}

		c.Set("ETag", `"`+obj.ETag+`"`)
		c.Set("Last-Modified", obj.LastModified.UTC().Format(http.TimeFormat))
		if obj.ContentType != "" {
			c.Set("Content-Type", obj.ContentType)
		}
		// fasthttp computes Content-Length from the (empty) body; set it
		// explicitly on the response header instead. SendStatus is avoided:
		// it fills the body with the status text ("OK", 2 bytes), which
		// would override the advertised length.
		c.Response().Header.SetContentLength(int(obj.Size))
		c.Response().ResetBody()
		c.Response().SetStatusCode(fiber.StatusOK)
		return nil
	}

	reader, obj, err := conn.GetObject(ctx, key)
	if err != nil {
		return h.sendError(c, errNoSuchKey)
	}

	c.Set("ETag", `"`+obj.ETag+`"`)
	c.Set("Last-Modified", obj.LastModified.UTC().Format(http.TimeFormat))
	if obj.ContentType != "" {
		c.Set("Content-Type", obj.ContentType)
	}

	// fasthttp closes the stream after writing the response.
	return c.SendStream(reader, int(obj.Size))
}

func (h *handler) putObject(c fiber.Ctx, credential *models.S3Credential, bucketName, key string) error {
	conn, _, err := h.connectorFor(credential, bucketName)
	if err != nil {
		return h.sendError(c, err)
	}

	contentType := c.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	size := int64(c.Request().Header.ContentLength())
	body := io.Reader(requestBody(c))

	// Streaming-signature clients (aws-cli, minio-go) send aws-chunked
	// bodies: decode them so connectors receive the raw payload.
	if isAWSChunked(c.Get("X-Amz-Content-Sha256"), c.Get("Content-Encoding")) {
		if decoded := decodedContentLength(c.Get("X-Amz-Decoded-Content-Length")); decoded >= 0 {
			size = decoded
		}
		body = newAWSChunkedReader(body)
		if size < 0 {
			size = 0
		}
		if h.service.Logger != nil {
			h.service.Logger.Debug("s3 put object", "key", key, "content_length", c.Request().Header.ContentLength(), "decoded", c.Get("X-Amz-Decoded-Content-Length"), "size", size)
		}
	}

	ctx, cancel := context.WithTimeout(c.Context(), 30*time.Minute)
	defer cancel()

	obj, err := conn.PutObject(ctx, key, body, size, contentType)
	if err != nil {
		return h.sendError(c, errtrace.Wrap(err))
	}
	if h.service.Logger != nil {
		h.service.Logger.Debug("s3 put object done", "key", key, "stored_size", obj.Size, "etag", obj.ETag)
	}

	c.Set("ETag", `"`+obj.ETag+`"`)
	return c.SendStatus(200)
}

// requestBody returns the request body as a reader without triggering
// Fiber's Content-Encoding decode: aws-chunked bodies carry
// Content-Encoding: aws-chunked, which Fiber rejects with 415.
func requestBody(c fiber.Ctx) io.Reader {
	if s := c.Request().BodyStream(); s != nil {
		return s
	}
	return bytes.NewReader(c.Request().Body())
}

func (h *handler) deleteObject(c fiber.Ctx, credential *models.S3Credential, bucketName, key string) error {
	conn, _, err := h.connectorFor(credential, bucketName)
	if err != nil {
		return h.sendError(c, err)
	}

	ctx, cancel := context.WithTimeout(c.Context(), 30*time.Second)
	defer cancel()

	if err := conn.DeleteObject(ctx, key); err != nil {
		// S3 DeleteObject succeeds idempotently even when the key is absent.
		return h.sendError(c, errtrace.Wrap(err))
	}

	return c.Status(204).Send(nil)
}

// --- multipart operations ---

func (h *handler) multipartOps(c fiber.Ctx, credential *models.S3Credential, bucketName, key string) error {
	conn, bucket, err := h.connectorFor(credential, bucketName)
	if err != nil {
		return h.sendError(c, err)
	}

	ctx := context.WithoutCancel(c.Context())
	hasQuery := func(name string) bool {
		return c.Request().URI().QueryArgs().Has(name)
	}

	// POST /{bucket}/{key}?uploads — initiate.
	if hasQuery("uploads") && string(c.Method()) == http.MethodPost {
		info, err := conn.CreateMultipartUpload(ctx, key, c.Get("Content-Type"))
		if err != nil {
			return h.sendError(c, errtrace.Wrap(err))
		}
		return h.sendXML(c, 200, initiateMultipartUploadResult{
			Bucket: bucket.Name, Key: key, UploadID: info.UploadID,
		})
	}

	uploadID := c.Query("uploadId")

	// PUT /{bucket}/{key}?partNumber=N&uploadId=… — upload part.
	if string(c.Method()) == http.MethodPut && hasQuery("partNumber") {
		partNumber, convErr := strconv.Atoi(c.Query("partNumber"))
		if convErr != nil || partNumber < 1 || partNumber > 10000 {
			return h.sendError(c, errInvalidArgument)
		}

		size := int64(c.Request().Header.ContentLength())
		body := io.Reader(requestBody(c))
		if isAWSChunked(c.Get("X-Amz-Content-Sha256"), c.Get("Content-Encoding")) {
			if decoded := decodedContentLength(c.Get("X-Amz-Decoded-Content-Length")); decoded >= 0 {
				size = decoded
			}
			body = newAWSChunkedReader(body)
			if size < 0 {
				size = 0
			}
		}

		etag, err := conn.UploadPart(ctx, key, uploadID, partNumber, body, size)
		if err != nil {
			return h.sendError(c, errtrace.Wrap(err))
		}

		c.Set("ETag", `"`+etag+`"`)
		return c.SendStatus(200)
	}

	// POST /{bucket}/{key}?uploadId=… — complete.
	if string(c.Method()) == http.MethodPost && hasQuery("uploadId") {
		var payload completeMultipartUpload
		if err := xml.Unmarshal(c.Body(), &payload); err != nil || len(payload.Parts) == 0 {
			return h.sendError(c, errMalformedXML)
		}

		parts := make([]connectors.CompletedPart, 0, len(payload.Parts))
		for _, p := range payload.Parts {
			parts = append(parts, connectors.CompletedPart{PartNumber: p.PartNumber, ETag: p.ETag})
		}

		obj, err := conn.CompleteMultipartUpload(ctx, key, uploadID, parts)
		if err != nil {
			return h.sendError(c, errtrace.Wrap(err))
		}

		return h.sendXML(c, 200, completeMultipartUploadResult{
			Location: "https://" + c.Hostname() + "/" + bucketName + "/" + key,
			Bucket:   bucket.Name,
			Key:      key,
			ETag:     `"` + obj.ETag + `"`,
		})
	}

	// DELETE /{bucket}/{key}?uploadId=… — abort.
	if string(c.Method()) == http.MethodDelete && hasQuery("uploadId") {
		if err := conn.AbortMultipartUpload(ctx, key, uploadID); err != nil {
			return h.sendError(c, errtrace.Wrap(err))
		}
		return c.Status(204).Send(nil)
	}

	return h.sendError(c, errNotImplemented)
}

// --- responses ---

func (h *handler) sendXML(c fiber.Ctx, status int, v any) error {
	body, err := xml.Marshal(v)
	if err != nil {
		return errtrace.Wrap(err)
	}
	c.Set("Content-Type", "application/xml")
	return c.Status(status).Send([]byte(xml.Header + string(body)))
}

func (h *handler) sendError(c fiber.Ctx, err error) error {
	ae := mapError(err)
	if ae.code == "InternalError" && h.service.Logger != nil {
		h.service.Logger.Error("s3 gateway internal error", "method", string(c.Method()), "path", c.Path(), "error", err)
	}
	body, mErr := xml.Marshal(s3Error{
		Code:      ae.code,
		Message:   ae.message,
		Resource:  c.Path(),
		RequestID: fmt.Sprintf("%d", time.Now().UnixNano()),
	})
	if mErr != nil {
		return c.Status(500).SendString("InternalError")
	}
	c.Set("Content-Type", "application/xml")
	return c.Status(ae.status).Send([]byte(xml.Header + string(body)))
}
