package handlers

import "cloudrive/server/internal/app"

type Handlers struct {
	Health healthHandler
	User   userHandler
}

func New(app *app.Application) Handlers {
	return Handlers{
		Health: healthHandler{app: app},
		User:   userHandler{app: app, users: app.Repositories.User},
	}
}
