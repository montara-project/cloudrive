package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/secretbox"
	"cloudrive/server/internal/models"

	"github.com/google/uuid"
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

func (r *StorageAccountRepository) box() (*secretbox.SecretBox, error) {
	if r.Box == nil {
		return nil, errors.New("secretbox is not configured; refusing to handle credentials in plaintext")
	}
	return r.Box, nil
}

const storageAccountColumns = `
	id, organization_id, workspace_id, provider_id, owner_user_id,
	display_name, account_email, external_account_id, COALESCE(settings, '{}'::jsonb) AS settings,
	status, last_synced_at, deleted_at, created_at, updated_at`

func scanStorageAccount(row rowScanner) (models.StorageAccount, error) {
	var a models.StorageAccount
	err := row.Scan(&a.ID, &a.OrganizationID, &a.WorkspaceID, &a.ProviderID, &a.OwnerUserID,
		&a.DisplayName, &a.AccountEmail, &a.ExternalAccountID, &a.Settings,
		&a.Status, &a.LastSyncedAt, &a.DeletedAt, &a.CreatedAt, &a.UpdatedAt)
	return a, translateNotFound("storage_accounts", err)
}

// storageAccountSortColumns whitelists the columns a `sorted` value may order by.
var storageAccountSortColumns = map[string]string{
	"id":           "id",
	"display_name": "display_name",
	"status":       "status",
	"created_at":   "created_at",
	"updated_at":   "updated_at",
}

// Create inserts a connected account and its encrypted credentials in a
// single transaction.
func (r *StorageAccountRepository) Create(ctx context.Context, account models.StorageAccount, credentials []byte) error {
	box, err := r.box()
	if err != nil {
		return err
	}

	db, err := r.pool()
	if err != nil {
		return err
	}

	return lib.WithTransaction(ctx, db, func(tx *sql.Tx) error {
		txRepo := StorageAccountRepository{BaseRepository: BaseRepository{DB: tx}, Box: box}

		// pgx encodes []byte as a bytea literal, which jsonb rejects; jsonb
		// columns are sent as their JSON text instead.
		var settings any
		if len(account.Settings) > 0 {
			settings = string(account.Settings)
		}

		if _, err := txRepo.execContext(ctx, `
			INSERT INTO storage_accounts
				(id, organization_id, workspace_id, provider_id, owner_user_id,
				 display_name, account_email, external_account_id, settings, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			account.ID, account.OrganizationID, account.WorkspaceID, account.ProviderID, account.OwnerUserID,
			account.DisplayName, account.AccountEmail, account.ExternalAccountID, settings, account.Status,
		); err != nil {
			return translateDuplicate(err, "this storage account is already connected")
		}

		return txRepo.upsertSecret(ctx, box, account.ID, credentials)
	})
}

// upsertSecret seals the credentials and writes the vault row. Seal happens
// here — the plaintext never leaves this repository unencrypted.
func (r *StorageAccountRepository) upsertSecret(ctx context.Context, box *secretbox.SecretBox, accountID uuid.UUID, credentials []byte) error {
	encoded, err := box.Encrypt(credentials)
	if err != nil {
		return err
	}

	_, err = r.execContext(ctx, `
		INSERT INTO storage_account_secrets (storage_account_id, credentials_encrypted, key_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (storage_account_id) DO UPDATE
		SET credentials_encrypted = EXCLUDED.credentials_encrypted,
			key_id = EXCLUDED.key_id,
			updated_at = now()`,
		accountID, encoded, box.ActiveKeyID(),
	)
	return err
}

// Get returns one account by id.
func (r *StorageAccountRepository) Get(ctx context.Context, id uuid.UUID) (models.StorageAccount, error) {
	query := fmt.Sprintf(`SELECT %s FROM storage_accounts WHERE id = $1 AND deleted_at IS NULL`, storageAccountColumns)
	return scanStorageAccount(r.queryRowContext(ctx, query, id))
}

// GetWithProvider loads the account together with its provider catalog row
// in one query — the shape the connector registry consumes.
func (r *StorageAccountRepository) GetWithProvider(ctx context.Context, id uuid.UUID) (models.StorageAccount, models.Provider, error) {
	query := `
		SELECT a.id, a.organization_id, a.workspace_id, a.provider_id, a.owner_user_id,
		       a.display_name, a.account_email, a.external_account_id, COALESCE(a.settings, '{}'::jsonb) AS settings,
		       a.status, a.last_synced_at, a.deleted_at, a.created_at, a.updated_at,
		       p.id, p.slug, p.name, p.protocol, p.auth_type, p.capabilities,
		       p.is_active, p.deleted_at, p.created_at, p.updated_at
		FROM storage_accounts a
		JOIN providers p ON p.id = a.provider_id
		WHERE a.id = $1`

	row := r.queryRowContext(ctx, query, id)

	var a models.StorageAccount
	var p models.Provider
	err := row.Scan(&a.ID, &a.OrganizationID, &a.WorkspaceID, &a.ProviderID, &a.OwnerUserID,
		&a.DisplayName, &a.AccountEmail, &a.ExternalAccountID, &a.Settings,
		&a.Status, &a.LastSyncedAt, &a.DeletedAt, &a.CreatedAt, &a.UpdatedAt,
		&p.ID, &p.Slug, &p.Name, &p.Protocol, &p.AuthType, &p.Capabilities,
		&p.IsActive, &p.DeletedAt, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return models.StorageAccount{}, models.Provider{}, translateNotFound("storage_accounts", err)
	}
	return a, p, nil
}

// GetByExternalAccount returns the account a provider identity maps onto
// inside a workspace.
func (r *StorageAccountRepository) GetByExternalAccount(ctx context.Context, workspaceID uuid.UUID, providerID uuid.UUID, externalAccountID string) (models.StorageAccount, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM storage_accounts
		WHERE workspace_id = $1 AND provider_id = $2 AND external_account_id = $3`,
		storageAccountColumns)
	return scanStorageAccount(r.queryRowContext(ctx, query, workspaceID, providerID, externalAccountID))
}

// ListByWorkspace returns one page of a workspace's live accounts, ordered by
// p.Sorted. Callers clamp the offset/limit first (see dtos.ListQuery.Clamp).
func (r *StorageAccountRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, p ListParams) ([]models.StorageAccount, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM storage_accounts
		WHERE workspace_id = $1 AND deleted_at IS NULL
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		storageAccountColumns,
		resolveOrder(p.Sorted, storageAccountSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, workspaceID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanStorageAccount)
}

// CountByWorkspace returns how many live accounts the workspace has, for the
// response meta block.
func (r *StorageAccountRepository) CountByWorkspace(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM storage_accounts WHERE workspace_id = $1 AND deleted_at IS NULL`
	err := r.queryRowContext(ctx, query, workspaceID).Scan(&count)
	return count, err
}

// UpdateStatus transitions an account (pending_auth/active/expired/revoked/error).
func (r *StorageAccountRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	res, err := r.execContext(ctx, `
		UPDATE storage_accounts
		SET status = $2, updated_at = now()
		WHERE id = $1`,
		id, status,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "storage account")
}

// Update changes the account's mutable columns: display name and settings.
// Status has its own transition method; the external account identity is
// immutable.
func (r *StorageAccountRepository) Update(ctx context.Context, account models.StorageAccount) error {
	// pgx encodes []byte as a bytea literal, which jsonb rejects; jsonb
	// columns are sent as their JSON text instead.
	var settings any
	if len(account.Settings) > 0 {
		settings = string(account.Settings)
	}

	res, err := r.execContext(ctx, `
		UPDATE storage_accounts
		SET display_name = $2, settings = $3, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		account.ID, account.DisplayName, settings,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "storage account")
}

// UpdateCredentials replaces the stored credentials, sealing them with the
// active key. Used on token refresh and during key rotation sweeps.
func (r *StorageAccountRepository) UpdateCredentials(ctx context.Context, id uuid.UUID, credentials []byte) error {
	box, err := r.box()
	if err != nil {
		return err
	}

	db, err := r.pool()
	if err != nil {
		return err
	}

	return lib.WithTransaction(ctx, db, func(tx *sql.Tx) error {
		txRepo := StorageAccountRepository{BaseRepository: BaseRepository{DB: tx}, Box: box}
		if err := txRepo.upsertSecret(ctx, box, id, credentials); err != nil {
			return err
		}

		_, err := txRepo.execContext(ctx, `
			UPDATE storage_accounts
			SET updated_at = now()
			WHERE id = $1`,
			id,
		)
		return err
	})
}

// Credentials decrypts and returns the stored credentials for provider
// access. The plaintext lives only in memory for the duration of the call.
func (r *StorageAccountRepository) Credentials(ctx context.Context, id uuid.UUID) ([]byte, error) {
	box, err := r.box()
	if err != nil {
		return nil, err
	}

	query := `SELECT credentials_encrypted FROM storage_account_secrets WHERE storage_account_id = $1`

	var encoded string
	err = r.queryRowContext(ctx, query, id).Scan(&encoded)
	if err != nil {
		return nil, translateNotFound("storage_account_secrets", err)
	}

	plaintext, err := box.Decrypt(encoded)
	if err != nil {
		return nil, err
	}
	return plaintext, nil
}

// KeyRotationCandidates reports account ids whose vault rows are sealed with a
// key other than the active one, so they can be re-encrypted via
// UpdateCredentials after a key rotation.
func (r *StorageAccountRepository) KeyRotationCandidates(ctx context.Context) ([]uuid.UUID, error) {
	box, err := r.box()
	if err != nil {
		return nil, err
	}

	query := `
		SELECT storage_account_id
		FROM storage_account_secrets
		WHERE key_id <> $1
		ORDER BY storage_account_id`

	rows, err := r.queryContext(ctx, query, box.ActiveKeyID())
	if err != nil {
		return nil, err
	}
	return collectRows(rows, func(row rowScanner) (uuid.UUID, error) {
		var id uuid.UUID
		err := row.Scan(&id)
		return id, err
	})
}

// Count returns how many accounts exist, for the response meta block.
func (r *StorageAccountRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM storage_accounts WHERE deleted_at IS NULL`
	err := r.queryRowContext(ctx, query).Scan(&count)
	return count, err
}

// Delete soft-removes one account by stamping deleted_at.
func (r *StorageAccountRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE storage_accounts
		SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "storage account")
}

// Restore clears deleted_at on a soft-deleted account, returning ErrNotFound
// when the row is absent or not trashed.
func (r *StorageAccountRepository) Restore(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE storage_accounts
		SET deleted_at = NULL, updated_at = now()
		WHERE id = $1 AND deleted_at IS NOT NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "storage account")
}

// ForceDelete permanently removes the row, whether or not it is trashed.
// FK violations from referencing tables surface as a conflict.
func (r *StorageAccountRepository) ForceDelete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM storage_accounts WHERE id = $1`, id)
	if err != nil {
		return translateForeignKey(err, "storage account is still referenced by other records")
	}
	return requireAffected(res, "storage account")
}
