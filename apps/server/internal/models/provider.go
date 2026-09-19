package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Provider is a catalog entry for a storage provider type (Google Drive,
// OneDrive, Dropbox, S3-compatible, ...). It is global, not tenant-scoped:
// individual connections live in storage_accounts.
type Provider struct {
	ID           uuid.UUID       `db:"id" json:"id"`
	Slug         string          `db:"slug" json:"slug"`
	Name         string          `db:"name" json:"name"`
	Protocol     string          `db:"protocol" json:"protocol"`
	AuthType     string          `db:"auth_type" json:"auth_type"`
	Capabilities json.RawMessage `db:"capabilities" json:"capabilities,omitempty"`
	IsActive     bool            `db:"is_active" json:"is_active"`
	DeletedAt    *time.Time      `db:"deleted_at" json:"deleted_at,omitempty"`
	CreatedAt    time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updated_at"`
}
