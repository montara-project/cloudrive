package repositories

import (
	"context"
	"errors"
	"fmt"

	"cloudrive/server/internal/lib/secretbox"
	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// S3CredentialRepository owns the s3_credentials rows — the SigV4 access keys
// the S3 gateway verifies requests against. The secret part is sealed inside
// this repository with the same AES-256-GCM vault as provider credentials and
// is decrypted only when SecretKey() is called for signature verification.
type S3CredentialRepository struct {
	BaseRepository
	Box *secretbox.SecretBox
}

func (r *S3CredentialRepository) box() (*secretbox.SecretBox, error) {
	if r.Box == nil {
		return nil, errors.New("secretbox is not configured; refusing to handle secrets in plaintext")
	}
	return r.Box, nil
}

const s3CredentialColumns = `
	id, organization_id, workspace_id, user_id, access_key_id,
	secret_key_encrypted, key_id, label, status, last_used_at,
	created_at, updated_at`

func scanS3Credential(row rowScanner) (models.S3Credential, error) {
	var c models.S3Credential
	err := row.Scan(&c.ID, &c.OrganizationID, &c.WorkspaceID, &c.UserID, &c.AccessKeyID,
		&c.SecretKeyEncrypted, &c.KeyID, &c.Label, &c.Status, &c.LastUsedAt, &c.CreatedAt, &c.UpdatedAt)
	return c, translateNotFound("s3_credentials", err)
}

// s3CredentialSortColumns whitelists the columns a `sorted` value may order by.
var s3CredentialSortColumns = map[string]string{
	"id":            "id",
	"access_key_id": "access_key_id",
	"status":        "status",
	"last_used_at":  "last_used_at",
	"created_at":    "created_at",
}

// Create inserts a new access key and its encrypted secret. The caller sets
// ID (uuid.NewV7); the generated secret is returned so it can be shown to the
// user exactly once.
func (r *S3CredentialRepository) Create(ctx context.Context, credential models.S3Credential, secretKey []byte) (models.S3Credential, error) {
	box, err := r.box()
	if err != nil {
		return models.S3Credential{}, err
	}

	encoded, err := box.Encrypt(secretKey)
	if err != nil {
		return models.S3Credential{}, err
	}

	out := credential
	err = r.queryRowContext(ctx, `
		INSERT INTO s3_credentials
			(id, organization_id, workspace_id, user_id, access_key_id,
			 secret_key_encrypted, key_id, label, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at`,
		credential.ID,
		credential.OrganizationID,
		credential.WorkspaceID,
		credential.UserID,
		credential.AccessKeyID,
		encoded,
		box.ActiveKeyID(),
		credential.Label,
		credential.Status,
	).Scan(&out.CreatedAt, &out.UpdatedAt)
	if err != nil {
		return models.S3Credential{}, translateDuplicate(err, "this access key already exists")
	}
	return out, nil
}

// Get returns one credential by id.
func (r *S3CredentialRepository) Get(ctx context.Context, id uuid.UUID) (models.S3Credential, error) {
	query := fmt.Sprintf(`SELECT %s FROM s3_credentials WHERE id = $1`, s3CredentialColumns)
	return scanS3Credential(r.queryRowContext(ctx, query, id))
}

// GetActiveByAccessKeyID resolves the active credential a gateway request was
// signed with. Revoked keys must stop authenticating immediately.
func (r *S3CredentialRepository) GetActiveByAccessKeyID(ctx context.Context, accessKeyID string) (models.S3Credential, error) {
	query := fmt.Sprintf(`SELECT %s FROM s3_credentials WHERE access_key_id = $1 AND status = 'active'`, s3CredentialColumns)
	return scanS3Credential(r.queryRowContext(ctx, query, accessKeyID))
}

// ListByWorkspace returns one page of a workspace's access keys, ordered by
// p.Sorted. Callers clamp the offset/limit first (see dtos.ListQuery.Clamp).
func (r *S3CredentialRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, p ListParams) ([]models.S3Credential, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM s3_credentials
		WHERE workspace_id = $1
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		s3CredentialColumns,
		resolveOrder(p.Sorted, s3CredentialSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, workspaceID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanS3Credential)
}

// CountByWorkspace returns how many access keys the workspace has, for the
// response meta block.
func (r *S3CredentialRepository) CountByWorkspace(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM s3_credentials WHERE workspace_id = $1`
	err := r.queryRowContext(ctx, query, workspaceID).Scan(&count)
	return count, err
}

// TouchLastUsed records gateway activity on the credential. Failures are
// non-fatal for the request path; callers may ignore the error.
func (r *S3CredentialRepository) TouchLastUsed(ctx context.Context, id uuid.UUID) error {
	_, err := r.execContext(ctx, `
		UPDATE s3_credentials
		SET last_used_at = now()
		WHERE id = $1`,
		id,
	)
	return err
}

// UpdateStatus transitions the credential (active/revoked).
func (r *S3CredentialRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	res, err := r.execContext(ctx, `
		UPDATE s3_credentials
		SET status = $2, updated_at = now()
		WHERE id = $1`,
		id, status,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "s3 credential")
}

// SecretKey decrypts and returns the secret part of the access key for
// signature verification. The plaintext lives only in memory for the duration
// of the call.
func (r *S3CredentialRepository) SecretKey(ctx context.Context, id uuid.UUID) ([]byte, error) {
	box, err := r.box()
	if err != nil {
		return nil, err
	}

	query := `SELECT secret_key_encrypted FROM s3_credentials WHERE id = $1`

	var encoded string
	err = r.queryRowContext(ctx, query, id).Scan(&encoded)
	if err != nil {
		return nil, translateNotFound("s3_credentials", err)
	}

	plaintext, err := box.Decrypt(encoded)
	if err != nil {
		return nil, err
	}
	return plaintext, nil
}
