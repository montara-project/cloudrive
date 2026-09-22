package handlers

import (
	"errors"
	"fmt"
	"slices"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/validator"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ErrResponded reports that a helper has already written the HTTP response.
// It is non-nil so callers can propagate it with `return err`, and the Fiber
// error handler ignores it so the buffered response is delivered unchanged.
var ErrResponded = errors.New("response already written")

func pagination(c fiber.Ctx) (*repositories.QueryOptions, *dtos.ListQuery, error) {
	q := &dtos.ListQuery{}
	if err := lib.ValidateRequestQuery(c, q); err != nil {
		return nil, nil, requestError(c, err, "Invalid pagination parameters")
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

// listResponse wraps a page of results with pagination metadata.
func listResponse(c fiber.Ctx, q *dtos.ListQuery, total int64, data any) error {
	return c.JSON(fiber.Map{
		"data": data,
		"metadata": fiber.Map{
			"total":  total,
			"offset": q.Offset,
			"limit":  q.Limit,
		},
	})
}

// currentUser resolves the authenticated user set by the Authorization
// middleware.
func currentUser(c fiber.Ctx) (uuid.UUID, error) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return uuid.Nil, unauthorized(c)
	}
	return uid, nil
}

// respond writes the JSON body with the given status and reports
// ErrResponded so helpers can propagate "already handled" through their
// error return.
func respond(c fiber.Ctx, status int, body interface{}) error {
	if err := c.Status(status).JSON(body); err != nil {
		return err
	}
	return ErrResponded
}

func unauthorized(c fiber.Ctx) error {
	return respond(c, fiber.StatusUnauthorized, fiber.Map{"message": "Unauthorized, invalid bearer token"})
}

func badRequest(c fiber.Ctx, message string) error {
	return respond(c, fiber.StatusBadRequest, fiber.Map{"message": message})
}

func forbidden(c fiber.Ctx, message string) error {
	return respond(c, fiber.StatusForbidden, fiber.Map{"message": message})
}

// unprocessable renders a 422 with the per-field messages collected by a
// MapValidator.
func unprocessable(c fiber.Ctx, mr validator.MessageRecord) error {
	return respond(c, fiber.StatusUnprocessableEntity, lib.WrapValidationError(mr))
}

// requestError maps a failed request bind/validation onto the HTTP response:
// rule violations are a 422 keyed by field, anything else a 400.
func requestError(c fiber.Ctx, err error, message string) error {
	var ve *lib.ErrValidationFailed
	switch {
	case err == nil:
		return nil
	case errors.As(err, &ve):
		return unprocessable(c, ve.MessageRecord)
	default:
		return badRequest(c, message)
	}
}

// bindBody decodes the JSON request body into req and enforces the rules it
// declares. Malformed JSON is a 400; rule violations are a 422 keyed by
// field.
func bindBody(c fiber.Ctx, req lib.Validatable) error {
	return requestError(c, lib.ValidateRequestBody(c, req), "Invalid request body")
}

// respondError maps repository errors onto HTTP responses. Unknown errors are
// returned unwrapped so the Fiber error handler logs and renders them as 500.
func respondError(c fiber.Ctx, err error) error {
	var pqErr *pq.Error
	switch {
	case errors.Is(err, repositories.ErrRecordNotFound):
		return respond(c, fiber.StatusNotFound, "Resource not found")
	case errors.Is(err, repositories.ErrInsertDuplicate):
		return respond(c, fiber.StatusConflict, "Resource already exists")
	case errors.Is(err, repositories.ErrEditConflict):
		return respond(c, fiber.StatusConflict, "Resource changed or does not exist")
	case errors.As(err, &pqErr) && pqErr.Code == "23503":
		return respond(c, fiber.StatusUnprocessableEntity, "Operation references a resource that does not exist or is not allowed")
	default:
		return err
	}
}

// requireOrgMember ensures the user is a member of the organization; when
// roles is non-empty the member's role must be one of them. It returns the
// membership row on success.
func requireOrgMember(c fiber.Ctx, app *app.Application, orgID uuid.UUID, userID uuid.UUID, roles ...string) (*models.OrganizationMember, error) {
	member, err := app.Repositories.OrganizationMember.Get(orgID, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrRecordNotFound) {
			return nil, forbidden(c, "You do not have access to this organization")
		}
		return nil, err
	}

	if len(roles) > 0 && !slices.Contains(roles, member.Role) {
		return nil, forbidden(c, fmt.Sprintf("This action requires role: %v", roles))
	}

	return member, nil
}
