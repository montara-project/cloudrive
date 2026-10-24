package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
	"cloudrive/server/internal/lib/connectors"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type s3GatewayHandler struct {
	app *app.Application
}

func (h *s3GatewayHandler) repo() *repositories.S3BucketRepository {
	return &h.app.Repositories.S3Bucket
}

// authorizeWorkspace loads the workspace and requires the user to be an
// organization owner/admin for creation/issuance flows.
func (h *s3GatewayHandler) authorizeWorkspace(c fiber.Ctx, wsID, userID uuid.UUID) (models.Workspace, error) {
	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return models.Workspace{}, err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return models.Workspace{}, err
	}

	return workspace, nil
}

// --- S3 credentials (SigV4 access keys) ---

// CreateCredential issues a SigV4 access key for the workspace. The secret is
// generated server-side, shown exactly once in this response, and stored
// encrypted (AES-256-GCM) — it can never be retrieved again.
func (h *s3GatewayHandler) CreateCredential(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.authorizeWorkspace(c, wsID, userID)
	if err != nil {
		return err
	}

	// Body is optional (label only); ValidateRequestBody treats an absent
	// body as an empty object.
	req := &dtos.CreateS3CredentialRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	accessKeyID := "CR" + strings.ToUpper(randomToken(12))
	secretKey := randomToken(32)

	credential := models.S3Credential{
		OrganizationID: workspace.OrganizationID,
		WorkspaceID:    workspace.ID,
		UserID:         userID,
		AccessKeyID:    accessKeyID,
		Status:         "active",
	}
	if req.Label != "" {
		credential.Label = &req.Label
	}
	if credential.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	credential, err = h.app.Repositories.S3Credential.Create(c.Context(), credential, []byte(secretKey))
	if err != nil {
		return err
	}

	return dtos.Created(c, dtos.S3CredentialResponse{
		ID:          credential.ID,
		WorkspaceID: credential.WorkspaceID,
		AccessKeyID: credential.AccessKeyID,
		SecretKey:   secretKey,
		Label:       credential.Label,
		Status:      credential.Status,
		CreatedAt:   credential.CreatedAt,
	}, "Credential created")
}

// ListCredentials returns the workspace's access keys (never their secrets).
func (h *s3GatewayHandler) ListCredentials(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	credentials, err := h.app.Repositories.S3Credential.ListByWorkspace(c.Context(), wsID, params)
	if err != nil {
		return err
	}
	total, err := h.app.Repositories.S3Credential.CountByWorkspace(c.Context(), wsID)
	if err != nil {
		return err
	}

	return dtos.List(c, credentials, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// RevokeCredential disables an access key; it stops authenticating
// immediately. Requires owner or admin.
func (h *s3GatewayHandler) RevokeCredential(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}
	credentialID, err := pathID(c, "credentialId", "Invalid credential id")
	if err != nil {
		return err
	}

	if _, err := h.authorizeWorkspace(c, wsID, userID); err != nil {
		return err
	}

	credential, err := h.app.Repositories.S3Credential.Get(c.Context(), credentialID)
	if err != nil {
		return err
	}
	if credential.WorkspaceID != wsID {
		return apperr.New(apperr.KindForbidden, "Credential belongs to a different workspace")
	}

	if err := h.app.Repositories.S3Credential.UpdateStatus(c.Context(), credentialID, "revoked"); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Credential revoked")
}

// --- S3 buckets (mapping to storage accounts) ---

// CreateBucket maps a new S3 bucket name onto a connected storage account.
func (h *s3GatewayHandler) CreateBucket(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.authorizeWorkspace(c, wsID, userID)
	if err != nil {
		return err
	}

	req := &dtos.CreateS3BucketRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	accountID, err := uuid.Parse(req.StorageAccountID)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "Invalid storage_account_id")
	}

	account, err := h.app.Repositories.StorageAccount.Get(c.Context(), accountID)
	if err != nil {
		return err
	}
	if account.WorkspaceID != wsID {
		return apperr.New(apperr.KindForbidden, "Storage account belongs to a different workspace")
	}

	bucket := models.S3Bucket{
		OrganizationID:   workspace.OrganizationID,
		WorkspaceID:      workspace.ID,
		Name:             req.Name,
		StorageAccountID: accountID,
		RootPrefix:       req.RootPrefix,
		CreatedBy:        userID,
	}
	if bucket.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	if err := h.repo().Create(c.Context(), bucket); err != nil {
		return err
	}

	// Re-read so the response carries the DB-set timestamps.
	bucket, err = h.repo().Get(c.Context(), bucket.ID)
	if err != nil {
		return err
	}
	return dtos.Created(c, bucket, "Bucket mapping created")
}

// ListBuckets returns the workspace's bucket mappings.
func (h *s3GatewayHandler) ListBuckets(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	buckets, err := h.repo().ListByWorkspace(c.Context(), wsID, params)
	if err != nil {
		return err
	}
	total, err := h.repo().CountByWorkspace(c.Context(), wsID)
	if err != nil {
		return err
	}

	return dtos.List(c, buckets, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// DeleteBucket removes the bucket mapping only — objects in the backing
// storage account are untouched. Requires owner or admin.
func (h *s3GatewayHandler) DeleteBucket(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}
	bucketID, err := pathID(c, "bucketId", "Invalid bucket id")
	if err != nil {
		return err
	}

	if _, err := h.authorizeWorkspace(c, wsID, userID); err != nil {
		return err
	}

	bucket, err := h.repo().Get(c.Context(), bucketID)
	if err != nil {
		return err
	}
	if bucket.WorkspaceID != wsID {
		return apperr.New(apperr.KindForbidden, "Bucket belongs to a different workspace")
	}

	if err := h.repo().Delete(c.Context(), bucketID); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Bucket mapping deleted")
}

// randomToken returns n random bytes as unpadded base64 (URL-safe).
func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand failure is unrecoverable
	}
	return strings.TrimRight(base64.RawURLEncoding.EncodeToString(b), "=")
}

// --- Recent files ---

// RecentFile is one object aggregated across the workspace's gateway buckets.
// Key is relative to the bucket's root prefix, so it reads like the path the
// uploader used.
type RecentFile struct {
	Key              string    `json:"key"`
	Bucket           string    `json:"bucket"`
	Size             int64     `json:"size"`
	ContentType      string    `json:"content_type,omitempty"`
	LastModified     time.Time `json:"last_modified"`
	StorageAccountID string    `json:"storage_account_id"`
	ProviderSlug     string    `json:"provider_slug,omitempty"`
}

// recentFilesBucketCap bounds how many objects are fetched per bucket before
// the cross-bucket merge — enough to surface recent activity without walking
// large providers.
const recentFilesBucketCap = 100

// RecentFiles aggregates the most recently modified objects across the
// workspace's gateway buckets. Each bucket's backing connector is asked for
// its newest objects; provider failures degrade to partial results so one
// offline account cannot empty the section.
func (h *s3GatewayHandler) RecentFiles(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	limit := q.Limit
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	buckets, err := h.repo().ListByWorkspace(c.Context(), wsID, repositories.ListParams{Limit: 100})
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	var (
		mu    sync.Mutex
		wg    sync.WaitGroup
		files = make([]RecentFile, 0, len(buckets))
	)
	for _, bucket := range buckets {
		wg.Add(1)
		go func(bucket models.S3Bucket) {
			defer wg.Done()
			recent, err := h.recentFilesForBucket(ctx, bucket, limit)
			if err != nil {
				return // degraded: skip this bucket's contribution
			}
			mu.Lock()
			files = append(files, recent...)
			mu.Unlock()
		}(bucket)
	}
	wg.Wait()

	sort.Slice(files, func(i, j int) bool {
		return files[i].LastModified.After(files[j].LastModified)
	})
	if len(files) > limit {
		files = files[:limit]
	}

	return dtos.List(c, files, dtos.ListMeta(len(files), q.Offset, q.Limit))
}

// recentFilesForBucket lists the bucket's newest objects through its backing
// connector and maps them to relative keys.
func (h *s3GatewayHandler) recentFilesForBucket(
	ctx context.Context, bucket models.S3Bucket, limit int,
) ([]RecentFile, error) {
	account, provider, err := h.app.Repositories.StorageAccount.GetWithProvider(ctx, bucket.StorageAccountID)
	if err != nil {
		return nil, err
	}
	if account.Status != "active" {
		return nil, errors.New("storage account is not active")
	}

	credsJSON, err := h.app.Repositories.StorageAccount.Credentials(ctx, bucket.StorageAccountID)
	if err != nil {
		return nil, err
	}

	conn, err := ConnectorRegistry(h.app).New(
		connectors.AccountInput{ID: account.ID, Settings: account.Settings},
		provider.Protocol, provider.Slug,
		string(credsJSON),
	)
	if err != nil {
		return nil, err
	}

	page, err := conn.ListObjects(ctx, "", "", "", recentFilesBucketCap)
	if err != nil {
		return nil, err
	}

	// Connector keys are already relative to the account's root prefix, so
	// they read exactly like the paths uploaders used.
	files := make([]RecentFile, 0, len(page.Objects))
	for _, object := range page.Objects {
		// Directory markers and empty keys are not files.
		if object.Key == "" || strings.HasSuffix(object.Key, "/") {
			continue
		}
		files = append(files, RecentFile{
			Key:              object.Key,
			Bucket:           bucket.Name,
			Size:             object.Size,
			ContentType:      object.ContentType,
			LastModified:     object.LastModified,
			StorageAccountID: account.ID.String(),
			ProviderSlug:     provider.Slug,
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].LastModified.After(files[j].LastModified)
	})
	if len(files) > limit {
		files = files[:limit]
	}
	return files, nil
}

// --- My Drive ---

// DriveEntry is one folder or file at a prefix inside a provider account's
// drive, the shape the My Drive browser renders per row.
type DriveEntry struct {
	Name         string    `json:"name"`
	Type         string    `json:"type"` // "folder" | "file"
	Size         int64     `json:"size"`
	ContentType  string    `json:"content_type,omitempty"`
	LastModified time.Time `json:"last_modified"`
	AccountID    string    `json:"account_id"`
	AccountName  string    `json:"account_name"`
	ProviderSlug string    `json:"provider_slug,omitempty"`
}

// driveListCap bounds entries fetched per account before the merge.
const driveListCap = 200

// Drive browses provider accounts' drives like a file manager: with no
// `account` param it merges one level of every active account in the
// workspace (folders via the "/" delimiter, then files); with `account` it
// browses that single account. `prefix` navigates into folders.
func (h *s3GatewayHandler) Drive(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	limit := q.Limit
	if limit <= 0 || limit > 500 {
		limit = 200
	}

	prefix := strings.TrimPrefix(c.Query("prefix"), "/")
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	accounts, err := h.app.Repositories.StorageAccount.ListByWorkspace(c.Context(), wsID, repositories.ListParams{Limit: 100})
	if err != nil {
		return err
	}

	// An explicit account param scopes the browse to one provider account.
	if accountParam := c.Query("account"); accountParam != "" {
		accountID, err := uuid.Parse(accountParam)
		if err != nil {
			return apperr.New(apperr.KindBadRequest, "Invalid account id")
		}
		filtered := accounts[:0]
		for _, account := range accounts {
			if account.ID == accountID {
				filtered = append(filtered, account)
			}
		}
		accounts = filtered
	}

	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	var (
		mu      sync.Mutex
		wg      sync.WaitGroup
		entries = make([]DriveEntry, 0, len(accounts))
	)
	for _, account := range accounts {
		if account.Status != "active" {
			continue
		}
		wg.Add(1)
		go func(account models.StorageAccount) {
			defer wg.Done()
			list, err := h.driveEntriesForAccount(ctx, account, prefix, driveListCap)
			if err != nil {
				return // degraded: skip this account's contribution
			}
			mu.Lock()
			entries = append(entries, list...)
			mu.Unlock()
		}(account)
	}
	wg.Wait()

	// Folders first (alphabetical), then newest files — the file-manager order.
	sort.Slice(entries, func(i, j int) bool {
		fi, fj := entries[i].Type == "folder", entries[j].Type == "folder"
		if fi != fj {
			return fi
		}
		if fi && fj {
			return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
		}
		return entries[i].LastModified.After(entries[j].LastModified)
	})
	total := len(entries)
	if len(entries) > limit {
		entries = entries[:limit]
	}

	return dtos.List(c, entries, dtos.ListMeta(total, q.Offset, q.Limit))
}

// driveEntriesForAccount lists one level of the account's drive at prefix.
func (h *s3GatewayHandler) driveEntriesForAccount(
	ctx context.Context, account models.StorageAccount, prefix string, limit int,
) ([]DriveEntry, error) {
	_, provider, err := h.app.Repositories.StorageAccount.GetWithProvider(ctx, account.ID)
	if err != nil {
		return nil, err
	}

	credsJSON, err := h.app.Repositories.StorageAccount.Credentials(ctx, account.ID)
	if err != nil {
		return nil, err
	}

	conn, err := ConnectorRegistry(h.app).New(
		connectors.AccountInput{ID: account.ID, Settings: account.Settings},
		provider.Protocol, provider.Slug,
		string(credsJSON),
	)
	if err != nil {
		return nil, err
	}

	page, err := conn.ListObjects(ctx, prefix, "/", "", limit)
	if err != nil {
		return nil, err
	}

	// Connector keys/prefixes are relative to the account's root prefix.
	displayName := func(raw string) string {
		return strings.TrimSuffix(strings.TrimPrefix(raw, prefix), "/")
	}

	accountName := account.DisplayName
	if account.AccountEmail != nil && *account.AccountEmail != "" {
		accountName = *account.AccountEmail
	}

	entries := make([]DriveEntry, 0, len(page.CommonPrefixes)+len(page.Objects))
	for _, folder := range page.CommonPrefixes {
		name := displayName(folder)
		if name == "" {
			continue
		}
		entries = append(entries, DriveEntry{
			Name: name, Type: "folder", LastModified: time.Time{},
			AccountID: account.ID.String(), AccountName: accountName, ProviderSlug: provider.Slug,
		})
	}
	for _, object := range page.Objects {
		name := displayName(object.Key)
		if name == "" || strings.HasSuffix(object.Key, "/") {
			continue // directory marker
		}
		entries = append(entries, DriveEntry{
			Name: name, Type: "file", Size: object.Size, ContentType: object.ContentType,
			LastModified: object.LastModified,
			AccountID:    account.ID.String(), AccountName: accountName, ProviderSlug: provider.Slug,
		})
	}
	return entries, nil
}
