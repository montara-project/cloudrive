package models

import (
	"time"

	"github.com/google/uuid"
)

// Organization is the primary tenant of the multi-tenant hierarchy. The owner
// is whoever holds the 'owner' role in organization_members — typically the
// creator recorded in CreatedBy.
type Organization struct {
	ID        uuid.UUID  `db:"id" json:"id"`
	Name      string     `db:"name" json:"name"`
	Slug      string     `db:"slug" json:"slug"`
	Logo      *string    `db:"logo" json:"logo,omitempty"`
	CreatedBy uuid.UUID  `db:"created_by" json:"created_by"`
	DeletedAt *time.Time `db:"deleted_at" json:"deleted_at,omitempty"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt time.Time  `db:"updated_at" json:"updated_at"`
}
