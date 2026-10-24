package repositories

import "testing"

func TestResolveOrder(t *testing.T) {
	allowed := map[string]string{
		"id":         "id",
		"name":       "name",
		"created_at": "created_at",
		"updated_at": "updated_at",
	}

	tests := []struct {
		name     string
		sorted   string
		fallback string
		want     string
	}{
		{name: "default when the value is empty", sorted: "", fallback: "created_at DESC", want: "created_at DESC"},
		{name: "explicit column and direction", sorted: "name:asc", fallback: "created_at DESC", want: "name ASC"},
		{name: "missing direction reads as descending", sorted: "name", fallback: "created_at DESC", want: "name DESC"},
		{name: "unknown column falls back", sorted: `"id"; DROP TABLE users:asc`, fallback: "created_at DESC", want: "created_at DESC"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveOrder(tt.sorted, allowed, tt.fallback); got != tt.want {
				t.Fatalf("resolveOrder(%q) = %q, want %q", tt.sorted, got, tt.want)
			}
		})
	}
}
