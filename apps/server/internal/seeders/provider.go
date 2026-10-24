package seeders

import (
	"context"
	"database/sql"
)

type ProviderSeeder struct {
	DB *sql.DB
}

func (s ProviderSeeder) Name() string {
	return "provider"
}

// Seed inserts the provider catalog; rows whose slug already exists are left
// untouched, so their ids (referenced by storage accounts) never change.
func (s ProviderSeeder) Seed() error {
	providers := []struct{ slug, name, protocol, authType, capabilities string }{
		{"google_drive", "Google Drive", "oauth2_cloud", "oauth2", `{"versioning": true, "trash": true, "native_search": true}`},
		{"onedrive", "OneDrive", "oauth2_cloud", "oauth2", `{"versioning": true, "trash": true}`},
		{"dropbox", "Dropbox", "oauth2_cloud", "oauth2", `{"versioning": true, "trash": true}`},
		{"s3_compatible", "S3 Compatible", "s3_compatible", "access_key", `{"versioning": false, "trash": false, "multipart": true}`},
	}

	return runSeed(s.DB, func(ctx context.Context, tx *sql.Tx) error {
		for _, p := range providers {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO "providers" ("slug", "name", "protocol", "auth_type", "capabilities")
				VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT ("slug") DO NOTHING`,
				p.slug, p.name, p.protocol, p.authType, p.capabilities,
			); err != nil {
				return err
			}
		}
		return nil
	})
}
