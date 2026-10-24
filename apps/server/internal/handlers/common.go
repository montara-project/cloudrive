package handlers

import (
	"context"
	"net/http"
	"strings"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
	"cloudrive/server/internal/lib/connectors"
	"cloudrive/server/internal/lib/provideroauth"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// errUnauthorized keeps the message the Authorization middleware uses, so a
// missing identity reads the same wherever it is detected.
var errUnauthorized = apperr.New(apperr.KindUnauthorized, "Unauthorized, invalid bearer token")

// isNotFound reports whether err resolved to a 404, so callers can map a
// miss onto their own kind without depending on a sentinel.
func isNotFound(err error) bool {
	status, _ := apperr.From(err)
	return status == http.StatusNotFound
}

// pathID parses a uuid path parameter, answering 400 with message when it is
// malformed.
func pathID(c fiber.Ctx, param, message string) (uuid.UUID, error) {
	id, err := lib.ContextParamUUID(c, param)
	if err != nil {
		return uuid.Nil, apperr.New(apperr.KindBadRequest, "%s", message)
	}
	return id, nil
}

// listParams maps the clamped pagination query onto the repository controls,
// folding the order_by/order pair into the repository's "column:asc|desc"
// sort value.
func listParams(q dtos.ListQuery) repositories.ListParams {
	sorted := q.OrderBy
	if q.Order != "" {
		sorted += ":" + strings.ToLower(q.Order)
	}
	return repositories.ListParams{Offset: q.Offset, Limit: q.Limit, Sorted: sorted}
}

// currentUser resolves the authenticated user set by the Authorization
// middleware.
func currentUser(c fiber.Ctx) (uuid.UUID, error) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return uuid.Nil, errUnauthorized
	}
	return uid, nil
}

// requireOrgMember ensures the user is a member of the organization; when
// roles is non-empty the member's role must be one of them. It returns the
// membership row on success.
func requireOrgMember(ctx context.Context, app *app.Application, orgID uuid.UUID, userID uuid.UUID, roles ...string) (models.OrganizationMember, error) {
	member, err := app.Repositories.OrganizationMember.Get(ctx, orgID, userID)
	if err != nil {
		if isNotFound(err) {
			return models.OrganizationMember{}, apperr.New(apperr.KindForbidden, "You do not have access to this organization")
		}
		return models.OrganizationMember{}, err
	}

	if len(roles) > 0 {
		if !memberHasRole(member, roles) {
			return models.OrganizationMember{}, apperr.New(apperr.KindForbidden, "This action requires role: %v", roles)
		}
	}

	return member, nil
}

// memberHasRole reports whether the member's role is one of the allowed ones.
func memberHasRole(member models.OrganizationMember, roles []string) bool {
	for _, role := range roles {
		if member.Role == role {
			return true
		}
	}
	return false
}

// ConnectorRegistry builds the storage connector registry from config. The
// registry is stateless (connectors are created per request), so building it
// on demand keeps integrations out of the Application container.
func ConnectorRegistry(app *app.Application) connectors.Registry {
	cfg := app.Config
	return connectors.Registry{
		GoogleClientID:       cfg.Google.ClientID,
		GoogleClientSecret:   cfg.Google.ClientSecret,
		OneDriveClientID:     cfg.OneDrive.ClientID,
		OneDriveClientSecret: cfg.OneDrive.ClientSecret,
		OneDriveTenant:       cfg.OneDrive.Tenant,
		DropboxClientID:      cfg.Dropbox.ClientID,
		DropboxClientSecret:  cfg.Dropbox.ClientSecret,
		ServerURL:            cfg.App.ServerURL,
		StagingDir:           cfg.S3.StagingDir,
	}
}

// oauthSession signs and verifies the provider OAuth state with APP_SECRET.
func oauthSession(app *app.Application) *provideroauth.Session {
	return provideroauth.NewSession(app.Config.App.Secret)
}
