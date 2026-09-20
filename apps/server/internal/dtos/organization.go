package dtos

type CreateOrganizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
	Logo string `json:"logo"`
}

type UpdateOrganizationRequest struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}
