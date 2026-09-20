package dtos

import "github.com/google/uuid"

// AddMemberRequest is shared by organization and workspace member creation.
type AddMemberRequest struct {
	UserID uuid.UUID `json:"user_id"`
	Role   string    `json:"role"`
}

// UpdateMemberRoleRequest is shared by organization and workspace member
// role updates.
type UpdateMemberRoleRequest struct {
	Role string `json:"role"`
}
