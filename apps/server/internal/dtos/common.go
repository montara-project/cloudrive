package dtos

// ListQuery is the shared pagination/ordering binding for list endpoints.
// Page starts at 1; limit is clamped to 100.
type ListQuery struct {
	Page    int    `query:"page"`
	Limit   int    `query:"limit"`
	OrderBy string `query:"order_by"`
	Order   string `query:"order"`
}
