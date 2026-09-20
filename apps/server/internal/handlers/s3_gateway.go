package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"regexp"
	"strings"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type s3GatewayHandler struct {
	app *app.Application
}

// bucketNamePattern mirrors the S3 bucket naming rules enforced by the
// database CHECK constraint (3-63 chars, lowercase, dots/dashes).
var bucketNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`)

// authorizeWorkspace loads the workspace and requires the user to be an
// organization owner/admin for creation/issuance flows.
func (h *s3GatewayHandler) authorizeWorkspace(c fiber.Ctx, wsID, userID uuid.UUID) (*models.Workspace, error) {
	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return nil, respondError(c, err)
	}

	if _, err := requireOrgMember(c, h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return nil, err
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

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	workspace, err := h.authorizeWorkspace(c, wsID, userID)
	if err != nil {
		return err
	}

	req := &dtos.CreateS3CredentialRequest{}
	_ = c.Bind().Body(req) // body is optional (label only)

	accessKeyID := "CR" + strings.ToUpper(randomToken(12))
	secretKey := randomToken(32)

	credential := &models.S3Credential{
		OrganizationID: workspace.OrganizationID,
		WorkspaceID:    workspace.ID,
		UserID:         userID,
		AccessKeyID:    accessKeyID,
		Status:         "active",
	}
	if req.Label != "" {
		credential.Label = &req.Label
	}

	if err := h.app.Repositories.S3Credential.Create(credential, []byte(secretKey)); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(dtos.S3CredentialResponse{
		ID:          credential.ID,
		WorkspaceID: credential.WorkspaceID,
		AccessKeyID: credential.AccessKeyID,
		SecretKey:   secretKey,
		Label:       credential.Label,
		Status:      credential.Status,
		CreatedAt:   credential.CreatedAt,
	})
}

// ListCredentials returns the workspace's access keys (never their secrets).
func (h *s3GatewayHandler) ListCredentials(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return respondError(c, err)
	}

	if _, err := requireOrgMember(c, h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	opts, q, err := pagination(c)
	if err != nil {
		return badRequest(c, "Invalid pagination parameters")
	}

	credentials, metadata, err := h.app.Repositories.S3Credential.ListByWorkspace(wsID, opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, credentials)
}

// RevokeCredential disables an access key; it stops authenticating
// immediately. Requires owner or admin.
func (h *s3GatewayHandler) RevokeCredential(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}
	credentialID, err := lib.ContextParamUUID(c, "credentialId")
	if err != nil {
		return badRequest(c, "Invalid credential id")
	}

	if _, err := h.authorizeWorkspace(c, wsID, userID); err != nil {
		return err
	}

	credential, err := h.app.Repositories.S3Credential.Get(credentialID)
	if err != nil {
		return respondError(c, err)
	}
	if credential.WorkspaceID != wsID {
		return forbidden(c, "Credential belongs to a different workspace")
	}

	if err := h.app.Repositories.S3Credential.UpdateStatus(credentialID, "revoked"); err != nil {
		return respondError(c, err)
	}

	return c.JSON(fiber.Map{"message": "Credential revoked"})
}

// --- S3 buckets (mapping to storage accounts) ---

// CreateBucket maps a new S3 bucket name onto a connected storage account.
func (h *s3GatewayHandler) CreateBucket(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	workspace, err := h.authorizeWorkspace(c, wsID, userID)
	if err != nil {
		return err
	}

	req := &dtos.CreateS3BucketRequest{}
	if err := c.Bind().Body(req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	if !bucketNamePattern.MatchString(req.Name) {
		return badRequest(c, "Invalid bucket name (3-63 chars, lowercase letters, digits, dots and dashes)")
	}

	accountID, err := uuid.Parse(req.StorageAccountID)
	if err != nil {
		return badRequest(c, "Invalid storage_account_id")
	}

	account, err := h.app.Repositories.StorageAccount.Get(accountID)
	if err != nil {
		return respondError(c, err)
	}
	if account.WorkspaceID != wsID {
		return forbidden(c, "Storage account belongs to a different workspace")
	}

	bucket := &models.S3Bucket{
		OrganizationID:   workspace.OrganizationID,
		WorkspaceID:      workspace.ID,
		Name:             req.Name,
		StorageAccountID: accountID,
		RootPrefix:       req.RootPrefix,
		CreatedBy:        userID,
	}

	if err := h.app.Repositories.S3Bucket.Create(bucket); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(bucket)
}

// ListBuckets returns the workspace's bucket mappings.
func (h *s3GatewayHandler) ListBuckets(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return respondError(c, err)
	}

	if _, err := requireOrgMember(c, h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	opts, q, err := pagination(c)
	if err != nil {
		return badRequest(c, "Invalid pagination parameters")
	}

	buckets, metadata, err := h.app.Repositories.S3Bucket.ListByWorkspace(wsID, opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, buckets)
}

// DeleteBucket removes the bucket mapping only — objects in the backing
// storage account are untouched. Requires owner or admin.
func (h *s3GatewayHandler) DeleteBucket(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}
	bucketID, err := lib.ContextParamUUID(c, "bucketId")
	if err != nil {
		return badRequest(c, "Invalid bucket id")
	}

	if _, err := h.authorizeWorkspace(c, wsID, userID); err != nil {
		return err
	}

	bucket, err := h.app.Repositories.S3Bucket.Get(bucketID)
	if err != nil {
		return respondError(c, err)
	}
	if bucket.WorkspaceID != wsID {
		return forbidden(c, "Bucket belongs to a different workspace")
	}

	if err := h.app.Repositories.S3Bucket.Delete(bucketID); err != nil {
		return respondError(c, err)
	}

	return c.JSON(fiber.Map{"message": "Bucket mapping deleted"})
}

// randomToken returns n random bytes as unpadded base64 (URL-safe).
func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand failure is unrecoverable
	}
	return strings.TrimRight(base64.RawURLEncoding.EncodeToString(b), "=")
}
