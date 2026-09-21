package dtos

import "cloudrive/server/internal/lib/validator"

type CreateInvitationRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (dto CreateInvitationRequest) Validate(v *validator.MapValidator) {
	v.Field("email").Required().Email()
	// Optional; the handler defaults it to member. Invitations can never
	// grant ownership.
	v.Field("role").WithinS("admin", "member")
}

type UpdateInvitationRequest struct {
	Status string `json:"status"`
}

func (dto UpdateInvitationRequest) Validate(v *validator.MapValidator) {
	v.Field("status").Required().WithinS("accepted", "rejected", "revoked", "expired")
}
