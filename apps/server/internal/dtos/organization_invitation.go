package dtos

type CreateInvitationRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type UpdateInvitationRequest struct {
	Status string `json:"status"`
}
