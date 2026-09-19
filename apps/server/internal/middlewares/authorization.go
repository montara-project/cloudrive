package middlewares

import (
	"strings"
	"time"

	"cloudrive/server/internal/lib"

	"github.com/Authula/authula/models"
	authulaservices "github.com/Authula/authula/services"
	"github.com/Authula/authula/util"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

const SessionCookieName = "authula.session_token"

// Authorization resolves the caller's identity from either an
// "Authorization: Bearer <jwt>" header (external API clients minted by the
// jwt plugin) or the session cookie (browser clients), and exposes the parsed
// user id to handlers through fiber locals.
func (m Middlewares) Authorization() fiber.Handler {
	return func(c fiber.Ctx) error {
		if authorization := c.Get(fiber.HeaderAuthorization); authorization != "" {
			return m.authorizeByBearer(c, authorization)
		}

		return m.authorizeBySession(c)
	}
}

// authorizeByBearer validates a Bearer token from the Authorization header
// and sets the user ID in the context if valid.
func (m Middlewares) authorizeByBearer(c fiber.Ctx, authorization string) error {
	token, ok := bearerToken(authorization)
	if !ok {
		return unauthorizedByBearer(c)
	}

	jwtService, ok := m.app.Auth.ServiceRegistry.Get(models.ServiceJWT.String()).(authulaservices.JWTService)
	if !ok {
		return unauthorizedByBearer(c)
	}

	actor, err := jwtService.ValidateToken(c.Context(), token)
	if err != nil || actor == nil || actor.Type != models.ActorUser {
		return unauthorizedByBearer(c)
	}

	uid, err := uuid.Parse(actor.ID)
	if err != nil {
		return unauthorizedByBearer(c)
	}

	lib.ContextSetUID(c, uid)
	return c.Next()
}

// authorizeBySession validates a session cookie and sets the user ID in the
// context if valid.
func (m Middlewares) authorizeBySession(c fiber.Ctx) error {
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

// bearerToken extracts the token from a "Bearer <token>" header value, the
// same case-insensitive scheme handling the Authula bearer plugin uses.
func bearerToken(authorization string) (string, bool) {
	parts := strings.SplitN(authorization, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}

	token := strings.TrimSpace(parts[1])
	return token, token != ""
}

// unauthorizedByBearer returns a 401 response for invalid bearer tokens.
func unauthorizedByBearer(c fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"message": "Unauthorized, invalid bearer token",
	})
}

// unauthorizedBySession returns a 401 response for invalid session cookies.
func unauthorizedBySession(c fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"message": "Unauthorized, invalid session",
	})
}
