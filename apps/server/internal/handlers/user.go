package handlers

import (
	"errors"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type userHandler struct {
	app *app.Application
}

// Me returns the authenticated user's application profile. The bearer token
// is validated by the Authorization middleware, which also sets the uid local
// this handler reads.
func (h *userHandler) Me(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return errUnauthorized
	}

	user, err := h.app.Repositories.User.Get(uid)
	if err != nil {
		if errors.Is(err, repositories.ErrRecordNotFound) {
			return apperr.New(apperr.KindNotFound, "User not found")
		}
		return err
	}

	return dtos.OK(c, user)
}
