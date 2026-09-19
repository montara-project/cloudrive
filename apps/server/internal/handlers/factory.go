package handlers

import "cloudrive/server/internal/app"

type Handlers struct {
	Health healthHandler
}

func New(app *app.Application) Handlers {
	return Handlers{
		Health: healthHandler{app: app},
	}
}
