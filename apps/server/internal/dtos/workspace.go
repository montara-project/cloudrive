package dtos

import "cloudrive/server/internal/lib/validator"

type CreateWorkspaceRequest struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
}

func (dto CreateWorkspaceRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("slug").Required().String()
	v.Field("description").String()
}

type UpdateWorkspaceRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (dto UpdateWorkspaceRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("description").String()
}
