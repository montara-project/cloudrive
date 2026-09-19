package repositories

import (
	"database/sql"

	"cloudrive/server/internal/config"
)

type Repositories struct {
	Provider ProviderRepository
}

func New(db *sql.DB, cfg *config.ConfigApp) Repositories {
	return Repositories{
		Provider: ProviderRepository{BaseRepository: BaseRepository{DB: db}},
	}
}
