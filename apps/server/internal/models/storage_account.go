package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// StorageAccount is one connected provider account inside a workspace — a
// single provider (e.g. Google) may appear several times with different
// accounts. Credentials never live on this struct: they are encrypted into
// storage_account_secrets and only decrypted on demand by the repository.
type StorageAccount struct {
	ID                uuid.UUID       `db:"id" json:"id"`
	OrganizationID    uuid.UUID       `db:"organization_id" json:"organization_id"`
	WorkspaceID       uuid.UUID       `db:"workspace_id" json:"workspace_id"`
	ProviderID        uuid.UUID       `db:"provider_id" json:"provider_id"`
	OwnerUserID       uuid.UUID       `db:"owner_user_id" json:"owner_user_id"`
	DisplayName       string          `db:"display_name" json:"display_name"`
	AccountEmail      *string         `db:"account_email" json:"account_email,omitempty"`
	ExternalAccountID string          `db:"external_account_id" json:"external_account_id"`
	Settings          json.RawMessage `db:"settings" json:"settings,omitempty"`
	Status            string          `db:"status" json:"status"`
	LastSyncedAt      *time.Time      `db:"last_synced_at" json:"last_synced_at,omitempty"`
	DeletedAt         *time.Time      `db:"deleted_at" json:"deleted_at,omitempty"`
	CreatedAt         time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time       `db:"updated_at" json:"updated_at"`
}
