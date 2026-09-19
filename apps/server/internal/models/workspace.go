package models

import (
	"time"

	"github.com/google/uuid"
)

// Workspace is a sub-space of an organization. Its slug is unique within the
// organization, not globally.
type Workspace struct {
	ID             uuid.UUID  `db:"id" json:"id"`
	OrganizationID uuid.UUID  `db:"organization_id" json:"organization_id"`
	Name           string     `db:"name" json:"name"`
	Slug           string     `db:"slug" json:"slug"`
	Description    *string    `db:"description" json:"description,omitempty"`
	CreatedBy      uuid.UUID  `db:"created_by" json:"created_by"`
	DeletedAt      *time.Time `db:"deleted_at" json:"deleted_at,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
}
