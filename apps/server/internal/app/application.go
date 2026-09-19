package app

import (
	"log/slog"

	"cloudrive/server/internal/config"
	"cloudrive/server/internal/repositories"
	"cloudrive/server/internal/services"

	"github.com/Authula/authula"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	Repositories repositories.Repositories
	Services     services.Services
	Auth         *authula.Auth
}
