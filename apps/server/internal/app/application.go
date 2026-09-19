package app

import (
	"log/slog"

	"cloudrive/server/internal/config"
	"cloudrive/server/internal/repositories"
	"cloudrive/server/internal/services"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	Repositories repositories.Repositories
	Services     services.Services
}
