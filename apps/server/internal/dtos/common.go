package dtos

import "cloudrive/server/internal/lib/validator"

// ListQuery is the shared pagination/ordering binding for list endpoints.
// Offset starts at 0; limit is clamped to 100. Repositories resolve
// order_by against a whitelist and pair it with the asc/desc order value.
type ListQuery struct {
	Offset  int    `query:"offset"`
	Limit   int    `query:"limit"`
	OrderBy string `query:"order_by"`
	Order   string `query:"order"`
}

// Validate declares rules over the raw query map: every parameter is a
// string and optional, but when present it must be well formed.
func (dto ListQuery) Validate(v *validator.MapValidator) {
	v.Field("offset").Regex(`^\d+$`)
	v.Field("limit").Regex(`^\d+$`)
	v.Field("order_by")
	v.Field("order").Regex(`(?i)^(asc|desc)$`)
}

const (
	defaultListLimit = 20
	maxListLimit     = 100
)

// Clamp normalizes pagination values: a missing or zero limit falls back to
// 20 and the limit never exceeds 100.
func (dto *ListQuery) Clamp() {
	if dto.Limit <= 0 {
		dto.Limit = defaultListLimit
	}
	if dto.Limit > maxListLimit {
		dto.Limit = maxListLimit
	}
	if dto.Offset < 0 {
		dto.Offset = 0
	}
}
