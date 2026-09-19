package models

import (
	"time"

	"github.com/google/uuid"
)

// OrganizationMember links a user to an organization with a role of 'owner',
// 'admin', or 'member'. The database guarantees exactly one owner per
// organization and one membership per (organization, user) pair.
type OrganizationMember struct {
	ID             uuid.UUID `db:"id" json:"id"`
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	UserID         uuid.UUID `db:"user_id" json:"user_id"`
	Role           string    `db:"role" json:"role"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}
