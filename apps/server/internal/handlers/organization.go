package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type organizationHandler struct {
	app *app.Application
}

func (h *organizationHandler) repo() *repositories.OrganizationRepository {
	return &h.app.Repositories.Organization
}

// Create registers a new organization and makes the current user its owner in
// one transaction (repositories.OrganizationRepository.CreateWithOwner).
func (h *organizationHandler) Create(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	req := &dtos.CreateOrganizationRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	organization := models.Organization{
		Name:      req.Name,
		Slug:      req.Slug,
		CreatedBy: userID,
	}
	if req.Logo != "" {
		organization.Logo = &req.Logo
	}

	if err := h.repo().CreateWithOwner(c.Context(), organization, userID); err != nil {
		return err
	}

	// Re-read so the response carries the DB-set timestamps.
	organization, err = h.repo().Get(c.Context(), organization.ID)
	if err != nil {
		return err
	}
	return dtos.Created(c, organization, "Organization created")
}

// List returns the organizations the current user belongs to.
func (h *organizationHandler) List(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	organizations, err := h.repo().ListByUser(c.Context(), userID, params)
	if err != nil {
		return err
	}
	total, err := h.repo().CountByUser(c.Context(), userID)
	if err != nil {
		return err
	}

	return dtos.List(c, organizations, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// Get returns one organization. Any member of the organization may read it.
func (h *organizationHandler) Get(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, orgID, userID); err != nil {
		return err
	}

	organization, err := h.repo().Get(c.Context(), orgID)
	if err != nil {
		return err
	}

	return dtos.OK(c, organization)
}

// Update changes the organization profile. Requires the owner or admin role.
func (h *organizationHandler) Update(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &dtos.UpdateOrganizationRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	current, err := h.repo().Get(c.Context(), orgID)
	if err != nil {
		return err
	}

	current.Name = req.Name
	if req.Logo != "" {
		current.Logo = &req.Logo
	} else {
		current.Logo = nil
	}

	if err := h.repo().Update(c.Context(), current); err != nil {
		return err
	}

	current, err = h.repo().Get(c.Context(), orgID)
	if err != nil {
		return err
	}
	return dtos.OK(c, current)
}

// Delete soft-deletes the organization. Owner only.
func (h *organizationHandler) Delete(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, orgID, userID, "owner"); err != nil {
		return err
	}

	if err := h.repo().Delete(c.Context(), orgID); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Organization deleted")
}
