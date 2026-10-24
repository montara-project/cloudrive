package app

import (
	"database/sql"
	"log/slog"

	"cloudrive/server/internal/config"
	"cloudrive/server/internal/repositories"

	"github.com/Authula/authula"
)

// Application is the dependency container handed to handlers and
// middlewares. Integrations (connectors, provider OAuth, email) are built
// from Config where they are used, so they stay out of here.
type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	DB           *sql.DB
	Repositories repositories.Repositories
	Auth         *authula.Auth
}
