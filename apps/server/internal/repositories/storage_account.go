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

// StorageAccountRepository owns the storage_accounts rows and their 1:1
// storage_account_secrets vault rows. Encryption happens inside this
// repository — credentials are sealed with AES-256-GCM before any INSERT or
// UPDATE reaches the database and are decrypted only when Credentials() is
// called for a provider access — so no code path can persist plaintext
// credentials.
type StorageAccountRepository struct {
	BaseRepository
	Box *secretbox.SecretBox
}

func (r StorageAccountRepository) box() (*secretbox.SecretBox, error) {
	if r.Box == nil {
		return nil, errtrace.New("secretbox is not configured; refusing to handle credentials in plaintext")
	}
	return r.Box, nil
}

// Create inserts a connected account and its encrypted credentials in a
// single transaction.
func (r StorageAccountRepository) Create(account *models.StorageAccount, credentials []byte) error {
	box, err := r.box()
	if err != nil {
		return err
	}

	if account.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		account.ID = id
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return errtrace.Wrap(err)
	}

	if err := r.insertAccountExec(tx, account); err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := r.upsertSecretExec(tx, box, account.ID, credentials); err != nil {
		_ = tx.Rollback()
		return err
	}

	return errtrace.Wrap(tx.Commit())
}

func (r StorageAccountRepository) insertAccountExec(exc Executor, account *models.StorageAccount) error {
	query := `
		INSERT INTO "storage_accounts"
			("id", "organization_id", "workspace_id", "provider_id", "owner_user_id",
			 "display_name", "account_email", "external_account_id", "settings", "status")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	// lib/pq encodes []byte as a bytea literal, which jsonb rejects; jsonb
	// columns are sent as their JSON text instead.
	var settings any
	if len(account.Settings) > 0 {
		settings = string(account.Settings)
	}

	args := []any{
		account.ID,
		account.OrganizationID,
		account.WorkspaceID,
		account.ProviderID,
		account.OwnerUserID,
		account.DisplayName,
		account.AccountEmail,
		account.ExternalAccountID,
		settings,
		account.Status,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := exc.QueryRowContext(ctx, query, args...).Scan(&account.CreatedAt, &account.UpdatedAt)
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

// upsertSecretExec seals the credentials and writes the vault row. Seal
// happens here — the plaintext never leaves this repository unencrypted.
func (r StorageAccountRepository) upsertSecretExec(exc Executor, box *secretbox.SecretBox, accountID uuid.UUID, credentials []byte) error {
	encoded, err := box.Encrypt(credentials)
	if err != nil {
		return errtrace.Wrap(err)
	}

	query := `
		INSERT INTO "storage_account_secrets" ("storage_account_id", "credentials_encrypted", "key_id")
		VALUES ($1, $2, $3)
		ON CONFLICT ("storage_account_id") DO UPDATE
		SET "credentials_encrypted" = EXCLUDED."credentials_encrypted",
			"key_id" = EXCLUDED."key_id",
			"updated_at" = now();
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if _, err := exc.ExecContext(ctx, query, accountID, encoded, box.ActiveKeyID()); err != nil {
		return errtrace.Wrap(err)
	}

	return nil
}

func (r StorageAccountRepository) Get(id uuid.UUID) (*models.StorageAccount, error) {
	return r.getExec(r.DB, id)
}

// GetWithProvider loads the account together with its provider catalog row
// in one query — the shape the connector registry consumes.
func (r StorageAccountRepository) GetWithProvider(id uuid.UUID) (*models.StorageAccount, *models.Provider, error) {
	query := `
		SELECT a."id", a."organization_id", a."workspace_id", a."provider_id", a."owner_user_id",
		       a."display_name", a."account_email", a."external_account_id", a."settings",
		       a."status", a."last_synced_at", a."deleted_at", a."created_at", a."updated_at",
		       p."id", p."slug", p."name", p."protocol", p."auth_type", p."capabilities",
		       p."is_active", p."deleted_at", p."created_at", p."updated_at"
		FROM "storage_accounts" a
		JOIN "providers" p ON p."id" = a."provider_id"
		WHERE a."id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	account := &models.StorageAccount{}
	provider := &models.Provider{}
	err := r.DB.QueryRowContext(ctx, query, id).Scan(
		&account.ID,
		&account.OrganizationID,
		&account.WorkspaceID,
		&account.ProviderID,
		&account.OwnerUserID,
		&account.DisplayName,
		&account.AccountEmail,
		&account.ExternalAccountID,
		&account.Settings,
		&account.Status,
		&account.LastSyncedAt,
		&account.DeletedAt,
		&account.CreatedAt,
		&account.UpdatedAt,
		&provider.ID,
		&provider.Slug,
		&provider.Name,
		&provider.Protocol,
		&provider.AuthType,
		&provider.Capabilities,
		&provider.IsActive,
		&provider.DeletedAt,
		&provider.CreatedAt,
		&provider.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, nil, ErrRecordNotFound
		default:
			return nil, nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return account, provider, nil
}

func (r StorageAccountRepository) getExec(exc Executor, id uuid.UUID) (*models.StorageAccount, error) {
	query := `
		SELECT "id", "organization_id", "workspace_id", "provider_id", "owner_user_id",
		       "display_name", "account_email", "external_account_id", "settings",
		       "status", "last_synced_at", "deleted_at", "created_at", "updated_at"
		FROM "storage_accounts"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	account := &models.StorageAccount{}
	err := exc.QueryRowContext(ctx, query, id).Scan(
		&account.ID,
		&account.OrganizationID,
		&account.WorkspaceID,
		&account.ProviderID,
		&account.OwnerUserID,
		&account.DisplayName,
		&account.AccountEmail,
		&account.ExternalAccountID,
		&account.Settings,
		&account.Status,
		&account.LastSyncedAt,
		&account.DeletedAt,
		&account.CreatedAt,
		&account.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return account, nil
}

func (r StorageAccountRepository) GetByExternalAccount(workspaceID uuid.UUID, providerID uuid.UUID, externalAccountID string) (*models.StorageAccount, error) {
	return r.getByExternalAccountExec(r.DB, workspaceID, providerID, externalAccountID)
}

func (r StorageAccountRepository) getByExternalAccountExec(exc Executor, workspaceID uuid.UUID, providerID uuid.UUID, externalAccountID string) (*models.StorageAccount, error) {
	query := `
		SELECT "id", "organization_id", "workspace_id", "provider_id", "owner_user_id",
		       "display_name", "account_email", "external_account_id", "settings",
		       "status", "last_synced_at", "deleted_at", "created_at", "updated_at"
		FROM "storage_accounts"
		WHERE "workspace_id" = $1 AND "provider_id" = $2 AND "external_account_id" = $3;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	account := &models.StorageAccount{}
	err := exc.QueryRowContext(ctx, query, workspaceID, providerID, externalAccountID).Scan(
		&account.ID,
		&account.OrganizationID,
		&account.WorkspaceID,
		&account.ProviderID,
		&account.OwnerUserID,
		&account.DisplayName,
		&account.AccountEmail,
		&account.ExternalAccountID,
		&account.Settings,
		&account.Status,
		&account.LastSyncedAt,
		&account.DeletedAt,
		&account.CreatedAt,
		&account.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return account, nil
}

func (r StorageAccountRepository) ListByWorkspace(workspaceID uuid.UUID, opts *QueryOptions) ([]*models.StorageAccount, PaginationMetadata, error) {
	return r.listByWorkspaceExec(r.DB, workspaceID, opts)
}

func (r StorageAccountRepository) listByWorkspaceExec(exc Executor, workspaceID uuid.UUID, opts *QueryOptions) ([]*models.StorageAccount, PaginationMetadata, error) {
	baseQuery := `
		SELECT "id", "organization_id", "workspace_id", "provider_id", "owner_user_id",
		       "display_name", "account_email", "external_account_id", "settings",
		       "status", "last_synced_at", "deleted_at", "created_at", "updated_at"
		FROM "storage_accounts"
		WHERE "workspace_id" = $1 AND "deleted_at" IS NULL
	`

	var args []any
	argIndex := 2

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		"id":           true,
		"display_name": true,
		"status":       true,
		"created_at":   true,
		"updated_at":   true,
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

	rows, err := exc.QueryContext(ctx, query, append([]any{workspaceID}, args...)...)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}
	defer rows.Close()

	var accounts []*models.StorageAccount
	for rows.Next() {
		account := &models.StorageAccount{}
		if err := rows.Scan(
			&account.ID,
			&account.OrganizationID,
			&account.WorkspaceID,
			&account.ProviderID,
			&account.OwnerUserID,
			&account.DisplayName,
			&account.AccountEmail,
			&account.ExternalAccountID,
			&account.Settings,
			&account.Status,
			&account.LastSyncedAt,
			&account.DeletedAt,
			&account.CreatedAt,
			&account.UpdatedAt,
		); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		accounts = append(accounts, account)
	}

	count, err := r.countByWorkspaceExec(exc, workspaceID)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return accounts, PaginationMetadata{Total: count}, nil
}

// UpdateStatus transitions an account (pending_auth/active/expired/revoked/error).
func (r StorageAccountRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.updateStatusExec(r.DB, id, status)
}

func (r StorageAccountRepository) updateStatusExec(exc Executor, id uuid.UUID, status string) error {
	query := `
		UPDATE "storage_accounts"
		SET "status" = $1, "updated_at" = now()
		WHERE "id" = $2;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, status, id)
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

// Update changes the account's mutable columns: display name and settings.
// Status has its own transition method; the external account identity is
// immutable.
func (r StorageAccountRepository) Update(id uuid.UUID, account *models.StorageAccount) error {
	return r.updateExec(r.DB, id, account)
}

func (r StorageAccountRepository) updateExec(exc Executor, id uuid.UUID, account *models.StorageAccount) error {
	query := `
		UPDATE "storage_accounts"
		SET "display_name" = $1, "settings" = $2, "updated_at" = now()
		WHERE "id" = $3;
	`

	r.debugQuery(query)

	// lib/pq encodes []byte as a bytea literal, which jsonb rejects; jsonb
	// columns are sent as their JSON text instead.
	var settings any
	if len(account.Settings) > 0 {
		settings = string(account.Settings)
	}

	args := []any{
		account.DisplayName,
		settings,
		id,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
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

// UpdateCredentials replaces the stored credentials, sealing them with the
// active key. Used on token refresh and during key rotation sweeps.
func (r StorageAccountRepository) UpdateCredentials(id uuid.UUID, credentials []byte) error {
	box, err := r.box()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return errtrace.Wrap(err)
	}

	if err := r.upsertSecretExec(tx, box, id, credentials); err != nil {
		_ = tx.Rollback()
		return err
	}

	touch := `
		UPDATE "storage_accounts"
		SET "updated_at" = now()
		WHERE "id" = $1;
	`

	r.debugQuery(touch)

	if _, err := tx.ExecContext(ctx, touch, id); err != nil {
		_ = tx.Rollback()
		return errtrace.Wrap(err)
	}

	return errtrace.Wrap(tx.Commit())
}

// Credentials decrypts and returns the stored credentials for provider
// access. The plaintext lives only in memory for the duration of the call.
func (r StorageAccountRepository) Credentials(id uuid.UUID) ([]byte, error) {
	box, err := r.box()
	if err != nil {
		return nil, err
	}

	return r.credentialsExec(r.DB, box, id)
}

func (r StorageAccountRepository) credentialsExec(exc Executor, box *secretbox.SecretBox, id uuid.UUID) ([]byte, error) {
	query := `
		SELECT "credentials_encrypted"
		FROM "storage_account_secrets"
		WHERE "storage_account_id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var encoded string
	err := exc.QueryRowContext(ctx, query, id).Scan(&encoded)
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

// KeyRotationCandidates reports account ids whose vault rows are sealed with a
// key other than the active one, so they can be re-encrypted via
// UpdateCredentials after a key rotation.
func (r StorageAccountRepository) KeyRotationCandidates() ([]uuid.UUID, error) {
	box, err := r.box()
	if err != nil {
		return nil, err
	}

	return r.keyRotationCandidatesExec(r.DB, box)
}

func (r StorageAccountRepository) keyRotationCandidatesExec(exc Executor, box *secretbox.SecretBox) ([]uuid.UUID, error) {
	query := `
		SELECT "storage_account_id"
		FROM "storage_account_secrets"
		WHERE "key_id" <> $1
		ORDER BY "storage_account_id";
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := exc.QueryContext(ctx, query, box.ActiveKeyID())
	if err != nil {
		return nil, errtrace.Wrap(err)
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
		ids = append(ids, id)
	}

	return ids, nil
}

func (r StorageAccountRepository) Count() (int64, error) {
	return r.BaseRepository.countExec(r.DB)
}

func (r StorageAccountRepository) Delete(id uuid.UUID) error {
	return r.BaseRepository.deleteExec(r.DB, id)
}

func (r StorageAccountRepository) SoftDelete(id uuid.UUID) error {
	return r.BaseRepository.softDeleteExec(r.DB, id)
}

func (r StorageAccountRepository) Restore(id uuid.UUID) error {
	return r.BaseRepository.restoreExec(r.DB, id)
}

func (r StorageAccountRepository) countByWorkspaceExec(exc Executor, workspaceID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM "storage_accounts"
		WHERE "workspace_id" = $1 AND "deleted_at" IS NULL;
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
