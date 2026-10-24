package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type userHandler struct {
	app *app.Application
}

func (h *userHandler) repo() *repositories.UserRepository {
	return &h.app.Repositories.User
}

// Me returns the authenticated user's application profile. The bearer token
// is validated by the Authorization middleware, which also sets the uid local
// this handler reads.
func (h *userHandler) Me(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return errUnauthorized
	}

	user, err := h.repo().Get(c.Context(), uid)
	if err != nil {
		return err
	}

	return dtos.OK(c, user)
}
