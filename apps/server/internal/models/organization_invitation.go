package models

import (
	"time"

	"github.com/google/uuid"
)

// OrganizationInvitation tracks an invite to join an organization, sent to an
// email address that may not belong to a registered user yet. Token is the
// secret carried by the invitation link.
type OrganizationInvitation struct {
	ID             uuid.UUID `db:"id" json:"id"`
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	Email          string    `db:"email" json:"email"`
	Role           string    `db:"role" json:"role"`
	Status         string    `db:"status" json:"status"`
	Token          string    `db:"token" json:"token"`
	InvitedBy      uuid.UUID `db:"invited_by" json:"invited_by"`
	ExpiresAt      time.Time `db:"expires_at" json:"expires_at"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}
