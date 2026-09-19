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
			ID:   uuid.Must(uuid.NewV7()),
			Name: "Google Drive",
		},
		{
			ID:   uuid.Must(uuid.NewV7()),
			Name: "OneDrive",
		},
		{
			ID:   uuid.Must(uuid.NewV7()),
			Name: "Dropbox",
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
