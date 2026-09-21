package handlers

import (
	"cloudrive/server/internal/app"

	"github.com/gofiber/fiber/v3"
)

type providerHandler struct {
	app *app.Application
}

// List returns the provider catalog (Google Drive, OneDrive, Dropbox, ...)
// shown by the "connect a provider" UI.
func (h *providerHandler) List(c fiber.Ctx) error {
	if _, err := currentUser(c); err != nil {
		return err
	}

	opts, q, err := pagination(c)
	if err != nil {
		return err
	}

	providers, metadata, err := h.app.Repositories.Provider.List(opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, providers)
}
