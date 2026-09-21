package dtos

import (
	"cloudrive/server/internal/lib/validator"

	"github.com/google/uuid"
)

// AddMemberRequest is shared by organization and workspace member creation.
type AddMemberRequest struct {
	UserID uuid.UUID `json:"user_id"`
	Role   string    `json:"role"`
}

func (dto AddMemberRequest) Validate(v *validator.MapValidator) {
	v.Field("user_id").Required().UUID()
	// The allowed role set differs between organizations and workspaces, so
	// membership in a concrete set is enforced by each handler.
	v.Field("role").String()
}

// UpdateMemberRoleRequest is shared by organization and workspace member
// role updates.
type UpdateMemberRoleRequest struct {
	Role string `json:"role"`
}

func (dto UpdateMemberRoleRequest) Validate(v *validator.MapValidator) {
	v.Field("role").Required().String()
}
