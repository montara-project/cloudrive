package models

import (
	"time"

	"github.com/google/uuid"
)

// WorkspaceMember links a user to a workspace with a role of 'admin',
// 'member', or 'viewer'. The database requires the user to already be a member
// of the workspace's organization, so leaving an organization removes every
// workspace membership inside it.
type WorkspaceMember struct {
	ID             uuid.UUID `db:"id" json:"id"`
	WorkspaceID    uuid.UUID `db:"workspace_id" json:"workspace_id"`
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	UserID         uuid.UUID `db:"user_id" json:"user_id"`
	Role           string    `db:"role" json:"role"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}
