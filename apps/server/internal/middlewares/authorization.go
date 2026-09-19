package middlewares

import (
	"time"

	"github.com/Authula/authula/util"
	"github.com/gofiber/fiber/v3"
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

		return c.Next()
	}
}

func unauthorizedBySession(c fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"message": "Unauthorized, invalid session",
	})
}
