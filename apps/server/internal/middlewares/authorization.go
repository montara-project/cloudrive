package middlewares

import (
	"time"

	"cloudrive/server/internal/lib"

	"github.com/Authula/authula/util"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

const SessionCookieName = "authula.session_token"

func (m Middlewares) Authorization() fiber.Handler {
	return func(c fiber.Ctx) error {
		token := c.Cookies(SessionCookieName)
		if token == "" {
			return unauthorizedBySession(c)
		}

		ctx := c.Context()
		coreServices := m.app.Auth.CoreServices()

		session, err := coreServices.SessionService.GetByToken(ctx, util.SHA256Hex(token))
		if err != nil || session == nil {
			return unauthorizedBySession(c)
		}

		if session.ExpiresAt.Before(time.Now().UTC()) {
			return unauthorizedBySession(c)
		}

		// Authula user IDs are UUID strings; expose the parsed id to handlers
		// through fiber locals.
		uid, err := uuid.Parse(session.UserID)
		if err != nil {
			return unauthorizedBySession(c)
		}
		lib.ContextSetUID(c, uid)

		return c.Next()
	}
}

func unauthorizedBySession(c fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"message": "Unauthorized, invalid session",
	})
}
