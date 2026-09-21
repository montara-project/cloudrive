package dtos

import "cloudrive/server/internal/lib/validator"

type CreateOrganizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
	Logo string `json:"logo"`
}

func (dto CreateOrganizationRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("slug").Required().String()
	v.Field("logo").String()
}

type UpdateOrganizationRequest struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}

func (dto UpdateOrganizationRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("logo").String()
}
