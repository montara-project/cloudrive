package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type providerHandler struct {
	app *app.Application
}

func (h *providerHandler) repo() *repositories.ProviderRepository {
	return &h.app.Repositories.Provider
}

// List returns the provider catalog (Google Drive, OneDrive, Dropbox, ...)
// shown by the "connect a provider" UI.
func (h *providerHandler) List(c fiber.Ctx) error {
	if _, err := currentUser(c); err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	providers, err := h.repo().List(c.Context(), params)
	if err != nil {
		return err
	}
	total, err := h.repo().Count(c.Context())
	if err != nil {
		return err
	}

	return dtos.List(c, providers, dtos.ListMeta(int(total), q.Offset, q.Limit))
}
