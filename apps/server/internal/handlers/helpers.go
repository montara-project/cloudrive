package handlers

import (
	"errors"
	"fmt"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// listQuery is the shared pagination/ordering binding for list endpoints.
// Page starts at 1; limit is clamped to 100.
type listQuery struct {
	Page    int    `query:"page"`
	Limit   int    `query:"limit"`
	OrderBy string `query:"order_by"`
	Order   string `query:"order"`
}

func pagination(c fiber.Ctx) (*repositories.QueryOptions, *listQuery, error) {
	q := &listQuery{}
	if err := c.Bind().Query(q); err != nil {
		return nil, nil, err
	}

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Limit > 100 {
		q.Limit = 100
	}

	return &repositories.QueryOptions{
		Limit:   int64(q.Limit),
		Offset:  int64((q.Page - 1) * q.Limit),
		OrderBy: q.OrderBy,
		Order:   q.Order,
	}, q, nil
}

// listResponse wraps a page of results with pagination metadata.
func listResponse(c fiber.Ctx, q *listQuery, total int64, data any) error {
	return c.JSON(fiber.Map{
		"data": data,
		"metadata": fiber.Map{
			"total": total,
			"page":  q.Page,
			"limit": q.Limit,
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

func unauthorized(c fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"message": "Unauthorized, invalid session",
	})
}

func badRequest(c fiber.Ctx, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": message})
}

func forbidden(c fiber.Ctx, message string) error {
	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": message})
}

// respondError maps repository errors onto HTTP responses. Unknown errors are
// returned unwrapped so the Fiber error handler logs and renders them as 500.
func respondError(c fiber.Ctx, err error) error {
	var pqErr *pq.Error
	switch {
	case errors.Is(err, repositories.ErrRecordNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Resource not found"})
	case errors.Is(err, repositories.ErrInsertDuplicate):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"message": "Resource already exists"})
	case errors.Is(err, repositories.ErrEditConflict):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"message": "Resource changed or does not exist"})
	case errors.As(err, &pqErr) && pqErr.Code == "23503":
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"message": "Operation references a resource that does not exist or is not allowed",
		})
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

	if len(roles) > 0 && !contains(roles, member.Role) {
		return nil, forbidden(c, fmt.Sprintf("This action requires role: %v", roles))
	}

	return member, nil
}

func contains(values []string, want string) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}
