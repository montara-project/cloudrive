package seeders

import (
	"database/sql"

	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/google/uuid"
)

type ProviderSeeder struct {
	DB *sql.DB
}

func (s ProviderSeeder) Name() string {
	return "provider"
}

func (s ProviderSeeder) Seed() {
	providers := []*models.Provider{
		{
			ID:           uuid.Must(uuid.NewV7()),
			Slug:         "google_drive",
			Name:         "Google Drive",
			Protocol:     "oauth2_cloud",
			AuthType:     "oauth2",
			Capabilities: []byte(`{"versioning": true, "trash": true, "native_search": true}`),
		},
		{
			ID:           uuid.Must(uuid.NewV7()),
			Slug:         "onedrive",
			Name:         "OneDrive",
			Protocol:     "oauth2_cloud",
			AuthType:     "oauth2",
			Capabilities: []byte(`{"versioning": true, "trash": true}`),
		},
		{
			ID:           uuid.Must(uuid.NewV7()),
			Slug:         "dropbox",
			Name:         "Dropbox",
			Protocol:     "oauth2_cloud",
			AuthType:     "oauth2",
			Capabilities: []byte(`{"versioning": true, "trash": true}`),
		},
		{
			ID:           uuid.Must(uuid.NewV7()),
			Slug:         "s3_compatible",
			Name:         "S3 Compatible",
			Protocol:     "s3_compatible",
			AuthType:     "access_key",
			Capabilities: []byte(`{"versioning": false, "trash": false, "multipart": true}`),
		},
	}

	providerRepo := repositories.ProviderRepository{
		BaseRepository: repositories.BaseRepository{
			DB:        s.DB,
			TableName: "providers",
		},
	}

	if err := providerRepo.Insert(providers...); err != nil {
		panic(err)
	}
}
