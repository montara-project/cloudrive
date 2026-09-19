package repositories

import (
	"database/sql"

	"cloudrive/server/internal/config"
)

type Repositories struct {
	Provider ProviderRepository
	User     UserRepository
}

func New(db *sql.DB, cfg *config.ConfigApp) Repositories {
	return Repositories{
		Provider: ProviderRepository{BaseRepository: BaseRepository{DB: db}},
		User:     UserRepository{BaseRepository: BaseRepository{DB: db}},
	}
}
