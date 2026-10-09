package middlewares

import (
	"strings"

	"cloudrive/server/internal/lib"

	"github.com/Authula/authula/models"
	authulaservices "github.com/Authula/authula/services"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// Authorization resolves the caller's identity from an
// "Authorization: Bearer <jwt>" header (tokens minted by the jwt plugin) and
// exposes the parsed user id to handlers through fiber locals. There is no
// session-cookie path — bearer tokens are the only credential.
func (m Middlewares) Authorization() fiber.Handler {
	return func(c fiber.Ctx) error {
		return m.authorizeByBearer(c, c.Get(fiber.HeaderAuthorization))
	}
}

// authorizeByBearer validates a Bearer token from the Authorization header
// and sets the user ID in the context if valid.
func (m Middlewares) authorizeByBearer(c fiber.Ctx, authorization string) error {
	token, ok := bearerToken(authorization)
	if !ok {
		return unauthorized(c)
	}

	jwtService, ok := m.app.Auth.ServiceRegistry.Get(models.ServiceJWT.String()).(authulaservices.JWTService)
	if !ok {
		return unauthorized(c)
	}

	actor, err := jwtService.ValidateToken(c.Context(), token)
	if err != nil || actor == nil || actor.Type != models.ActorUser {
		return unauthorized(c)
	}

	uid, err := uuid.Parse(actor.ID)
	if err != nil {
		return unauthorized(c)
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

// unauthorized returns a 401 response for missing or invalid bearer tokens.
func unauthorized(c fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"message": "Unauthorized, invalid bearer token",
	})
}
