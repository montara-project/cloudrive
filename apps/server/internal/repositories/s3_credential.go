package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"cloudrive/server/internal/lib/secretbox"
	"cloudrive/server/internal/models"

	"braces.dev/errtrace"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// S3CredentialRepository owns the s3_credentials rows — the SigV4 access keys
// the S3 gateway verifies requests against. The secret part is sealed inside
// this repository with the same AES-256-GCM vault as provider credentials and
// is decrypted only when SecretKey() is called for signature verification.
type S3CredentialRepository struct {
	BaseRepository
	Box *secretbox.SecretBox
}

func (r S3CredentialRepository) box() (*secretbox.SecretBox, error) {
	if r.Box == nil {
		return nil, errtrace.New("secretbox is not configured; refusing to handle secrets in plaintext")
	}
	return r.Box, nil
}

// Create inserts a new access key and its encrypted secret. The generated
// secret is returned so it can be shown to the user exactly once.
func (r S3CredentialRepository) Create(credential *models.S3Credential, secretKey []byte) error {
	box, err := r.box()
	if err != nil {
		return err
	}

	if credential.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		credential.ID = id
	}

	encoded, err := box.Encrypt(secretKey)
	if err != nil {
		return errtrace.Wrap(err)
	}

	query := `
		INSERT INTO "s3_credentials"
			("id", "organization_id", "workspace_id", "user_id", "access_key_id",
			 "secret_key_encrypted", "key_id", "label", "status")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err = r.DB.QueryRowContext(ctx, query,
		credential.ID,
		credential.OrganizationID,
		credential.WorkspaceID,
		credential.UserID,
		credential.AccessKeyID,
		encoded,
		box.ActiveKeyID(),
		credential.Label,
		credential.Status,
	).Scan(&credential.CreatedAt, &credential.UpdatedAt)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok {
			if pqErr.Code == "23505" {
				return errtrace.Wrap(ErrInsertDuplicate)
			}
		}
		return errtrace.Errorf("error scanning row: %w", err)
	}

	return nil
}

const s3CredentialSelect = `
	SELECT "id", "organization_id", "workspace_id", "user_id", "access_key_id",
	       "secret_key_encrypted", "key_id", "label", "status", "last_used_at",
	       "created_at", "updated_at"
	FROM "s3_credentials"
`

func (r S3CredentialRepository) scanCredential(row *sql.Row) (*models.S3Credential, error) {
	credential := &models.S3Credential{}
	err := row.Scan(
		&credential.ID,
		&credential.OrganizationID,
		&credential.WorkspaceID,
		&credential.UserID,
		&credential.AccessKeyID,
		&credential.SecretKeyEncrypted,
		&credential.KeyID,
		&credential.Label,
		&credential.Status,
		&credential.LastUsedAt,
		&credential.CreatedAt,
		&credential.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return credential, nil
}

func (r S3CredentialRepository) Get(id uuid.UUID) (*models.S3Credential, error) {
	query := s3CredentialSelect + ` WHERE "id" = $1;`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return r.scanCredential(r.DB.QueryRowContext(ctx, query, id))
}

// GetActiveByAccessKeyID resolves the active credential a gateway request was
// signed with. Revoked keys must stop authenticating immediately.
func (r S3CredentialRepository) GetActiveByAccessKeyID(accessKeyID string) (*models.S3Credential, error) {
	query := s3CredentialSelect + ` WHERE "access_key_id" = $1 AND "status" = 'active';`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return r.scanCredential(r.DB.QueryRowContext(ctx, query, accessKeyID))
}

func (r S3CredentialRepository) ListByWorkspace(workspaceID uuid.UUID, opts *QueryOptions) ([]*models.S3Credential, PaginationMetadata, error) {
	baseQuery := s3CredentialSelect + `
		WHERE "workspace_id" = $1
	`

	var args []any
	argIndex := 2

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		"id":            true,
		"access_key_id": true,
		"status":        true,
		"last_used_at":  true,
		"created_at":    true,
	}

	orderBy, order, err := buildOrderBy(opts, allowedOrderByColumns, "created_at")
	if err != nil {
		return nil, PaginationMetadata{}, err
	}

	queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %q %s", orderBy, order))

	if opts.Limit > 0 {
		queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", argIndex))
		args = append(args, opts.Limit)
		argIndex++
	}

	if opts.Offset > 0 {
		queryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", argIndex))
		args = append(args, opts.Offset)
		argIndex++
	}

	query := queryBuilder.String()

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := r.DB.QueryContext(ctx, query, append([]any{workspaceID}, args...)...)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}
	defer rows.Close()

	var credentials []*models.S3Credential
	for rows.Next() {
		credential := &models.S3Credential{}
		if err := rows.Scan(
			&credential.ID,
			&credential.OrganizationID,
			&credential.WorkspaceID,
			&credential.UserID,
			&credential.AccessKeyID,
			&credential.SecretKeyEncrypted,
			&credential.KeyID,
			&credential.Label,
			&credential.Status,
			&credential.LastUsedAt,
			&credential.CreatedAt,
			&credential.UpdatedAt,
		); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		credentials = append(credentials, credential)
	}

	count, err := r.countByWorkspace(r.DB, workspaceID)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return credentials, PaginationMetadata{Total: count}, nil
}

func (r S3CredentialRepository) countByWorkspace(exc Executor, workspaceID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM "s3_credentials"
		WHERE "workspace_id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var count int64
	if err := exc.QueryRowContext(ctx, query, workspaceID).Scan(&count); err != nil {
		return 0, errtrace.Errorf("error scanning row: %w", err)
	}

	return count, nil
}

// TouchLastUsed records gateway activity on the credential. Failures are
// non-fatal for the request path; callers may ignore the error.
func (r S3CredentialRepository) TouchLastUsed(id uuid.UUID) error {
	query := `
		UPDATE "s3_credentials"
		SET "last_used_at" = now()
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := r.DB.ExecContext(ctx, query, id)
	return errtrace.Wrap(err)
}

// UpdateStatus transitions the credential (active/revoked).
func (r S3CredentialRepository) UpdateStatus(id uuid.UUID, status string) error {
	query := `
		UPDATE "s3_credentials"
		SET "status" = $1, "updated_at" = now()
		WHERE "id" = $2;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := r.DB.ExecContext(ctx, query, status, id)
	if err != nil {
		return errtrace.Wrap(err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrEditConflict
	}

	return nil
}

// SecretKey decrypts and returns the secret part of the access key for
// signature verification. The plaintext lives only in memory for the duration
// of the call.
func (r S3CredentialRepository) SecretKey(id uuid.UUID) ([]byte, error) {
	box, err := r.box()
	if err != nil {
		return nil, err
	}

	query := `
		SELECT "secret_key_encrypted"
		FROM "s3_credentials"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var encoded string
	err = r.DB.QueryRowContext(ctx, query, id).Scan(&encoded)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	plaintext, err := box.Decrypt(encoded)
	if err != nil {
		return nil, errtrace.Wrap(err)
	}

	return plaintext, nil
}
