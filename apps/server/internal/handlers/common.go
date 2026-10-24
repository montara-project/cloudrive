package handlers

import (
	"errors"
	"slices"

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
	"github.com/lib/pq"
)

// errUnauthorized keeps the message the Authorization middleware uses, so a
// missing identity reads the same wherever it is detected.
var errUnauthorized = apperr.New(apperr.KindUnauthorized, "Unauthorized, invalid bearer token")

// pagination binds and clamps the shared list query: offset from 0, limit
// defaulting to 20 and capped at 100.
func pagination(c fiber.Ctx) (*repositories.QueryOptions, *dtos.ListQuery, error) {
	q := &dtos.ListQuery{}
	if err := lib.ValidateRequestQuery(c, q); err != nil {
		return nil, nil, err
	}

	if q.Offset < 0 {
		q.Offset = 0
	}
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Limit > 100 {
		q.Limit = 100
	}

	return &repositories.QueryOptions{
		Limit:   int64(q.Limit),
		Offset:  int64(q.Offset),
		OrderBy: q.OrderBy,
		Order:   q.Order,
	}, q, nil
}

// listMeta builds the pagination metadata of a list response.
func listMeta(q *dtos.ListQuery, total int64) dtos.Metadata {
	return dtos.ListMeta(int(total), q.Offset, q.Limit)
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

// pathUUID parses a uuid path parameter, answering 400 with message when it
// is malformed.
func pathUUID(c fiber.Ctx, param, message string) (uuid.UUID, error) {
	id, err := lib.ContextParamUUID(c, param)
	if err != nil {
		return uuid.Nil, apperr.New(apperr.KindBadRequest, "%s", message)
	}
	return id, nil
}

// dbError maps a foreign-key violation onto a 422; repository sentinels are
// already typed (repositories/error.go) and everything else stays a 500.
func dbError(err error) error {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == "23503" {
		return apperr.New(apperr.KindUnprocessable, "Operation references a resource that does not exist or is not allowed")
	}
	return err
}

// requireOrgMember ensures the user is a member of the organization; when
// roles is non-empty the member's role must be one of them. It returns the
// membership row on success.
func requireOrgMember(app *app.Application, orgID uuid.UUID, userID uuid.UUID, roles ...string) (*models.OrganizationMember, error) {
	member, err := app.Repositories.OrganizationMember.Get(orgID, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrRecordNotFound) {
			return nil, apperr.New(apperr.KindForbidden, "You do not have access to this organization")
		}
		return nil, err
	}

	if len(roles) > 0 && !slices.Contains(roles, member.Role) {
		return nil, apperr.New(apperr.KindForbidden, "This action requires role: %v", roles)
	}

	return member, nil
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
