package dtos

import "cloudrive/server/internal/lib/validator"

// ListQuery is the shared pagination/ordering binding for list endpoints.
// Page starts at 1; limit is clamped to 100.
type ListQuery struct {
	Page    int    `query:"page"`
	Limit   int    `query:"limit"`
	OrderBy string `query:"order_by"`
	Order   string `query:"order"`
}

// Validate declares rules over the raw query map: every parameter is a
// string and optional, but when present it must be well formed.
func (dto ListQuery) Validate(v *validator.MapValidator) {
	v.Field("page").Regex(`^\d+$`)
	v.Field("limit").Regex(`^\d+$`)
	v.Field("order_by")
	v.Field("order").Regex(`(?i)^(asc|desc)$`)
}
