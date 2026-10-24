package app

import (
	"log/slog"

	"cloudrive/server/internal/config"
	"cloudrive/server/internal/connectors"
	"cloudrive/server/internal/repositories"
	"cloudrive/server/internal/services"
	"cloudrive/server/internal/services/provideroauth"

	"github.com/Authula/authula"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	Repositories repositories.Repositories
	Services     services.Services
	Connectors   Connectors
	Auth         *authula.Auth
}

// Connectors carries the storage connector registry and the OAuth state
// session used by the provider connect flow.
type Connectors struct {
	Registry connectors.Registry
	Session  *provideroauth.Session
}
