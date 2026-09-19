package repositories

import (
	"strings"
	"testing"
)

func TestBuildOrderBy(t *testing.T) {
	allowed := map[string]bool{
		"id":         true,
		"created_at": true,
	}

	tests := []struct {
		name           string
		opts           *QueryOptions
		defaultOrderBy string
		wantOrderBy    string
		wantOrder      string
		wantErr        bool
	}{
		{
			name:           "default is a bare column name (caller quotes it)",
			opts:           &QueryOptions{},
			defaultOrderBy: "created_at",
			wantOrderBy:    "created_at",
			wantOrder:      "DESC",
		},
		{
			name:           "explicit column and order",
			opts:           &QueryOptions{OrderBy: "id", Order: "asc"},
			defaultOrderBy: "created_at",
			wantOrderBy:    "id",
			wantOrder:      "ASC",
		},
		{
			name:           "order is case-insensitive",
			opts:           &QueryOptions{OrderBy: "id", Order: "DeSc"},
			defaultOrderBy: "created_at",
			wantOrderBy:    "id",
			wantOrder:      "DESC",
		},
		{
			name:           "rejects column outside the whitelist",
			opts:           &QueryOptions{OrderBy: `"id"; DROP TABLE users`},
			defaultOrderBy: "created_at",
			wantErr:        true,
		},
		{
			name:           "rejects invalid order",
			opts:           &QueryOptions{OrderBy: "id", Order: "sideways"},
			defaultOrderBy: "created_at",
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			orderBy, order, err := buildOrderBy(tt.opts, allowed, tt.defaultOrderBy)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("buildOrderBy() error = nil, want error")
				}
				return
			}
			if err != nil {
				t.Fatalf("buildOrderBy() error = %v", err)
			}
			if orderBy != tt.wantOrderBy || order != tt.wantOrder {
				t.Fatalf("buildOrderBy() = (%q, %q), want (%q, %q)", orderBy, order, tt.wantOrderBy, tt.wantOrder)
			}
			// Regression guard for the "syntax error at or near" ORDER BY bug:
			// identifiers reaching the caller must be bare so caller-side %q
			// quoting never double-quotes them.
			if strings.ContainsAny(orderBy, `"`) {
				t.Errorf("buildOrderBy() returned quoted identifier %q; callers quote it themselves", orderBy)
			}
		})
	}
}
