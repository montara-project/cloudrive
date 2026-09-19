package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type organizationHandler struct {
	app *app.Application
}

type createOrganizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
	Logo string `json:"logo"`
}

// Create registers a new organization and makes the current user its owner in
// one transaction (repositories.OrganizationRepository.CreateWithOwner).
func (h *organizationHandler) Create(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	req := &createOrganizationRequest{}
	if err := c.Bind().Body(req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	if req.Name == "" || req.Slug == "" {
		return badRequest(c, "Name and slug are required")
	}

	organization := &models.Organization{
		Name:      req.Name,
		Slug:      req.Slug,
		CreatedBy: userID,
	}
	if req.Logo != "" {
		organization.Logo = &req.Logo
	}

	if err := h.app.Repositories.Organization.CreateWithOwner(organization, userID); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(organization)
}

// List returns the organizations the current user belongs to.
func (h *organizationHandler) List(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	opts, q, err := pagination(c)
	if err != nil {
		return badRequest(c, "Invalid pagination parameters")
	}

	organizations, metadata, err := h.app.Repositories.Organization.ListByUser(userID, opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, organizations)
}

// Get returns one organization. Any member of the organization may read it.
func (h *organizationHandler) Get(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := lib.ContextParamUUID(c, "orgId")
	if err != nil {
		return badRequest(c, "Invalid organization id")
	}

	if _, err := requireOrgMember(c, h.app, orgID, userID); err != nil {
		return err
	}

	organization, err := h.app.Repositories.Organization.Get(orgID)
	if err != nil {
		return respondError(c, err)
	}

	return c.JSON(organization)
}

type updateOrganizationRequest struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}

// Update changes the organization profile. Requires the owner or admin role.
func (h *organizationHandler) Update(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := lib.ContextParamUUID(c, "orgId")
	if err != nil {
		return badRequest(c, "Invalid organization id")
	}

	if _, err := requireOrgMember(c, h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &updateOrganizationRequest{}
	if err := c.Bind().Body(req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return badRequest(c, "Name is required")
	}

	current, err := h.app.Repositories.Organization.Get(orgID)
	if err != nil {
		return respondError(c, err)
	}

	current.Name = req.Name
	if req.Logo != "" {
		current.Logo = &req.Logo
	} else {
		current.Logo = nil
	}

	if err := h.app.Repositories.Organization.Update(orgID, current); err != nil {
		return respondError(c, err)
	}

	return c.JSON(current)
}

// Delete soft-deletes the organization. Owner only.
func (h *organizationHandler) Delete(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := lib.ContextParamUUID(c, "orgId")
	if err != nil {
		return badRequest(c, "Invalid organization id")
	}

	if _, err := requireOrgMember(c, h.app, orgID, userID, "owner"); err != nil {
		return err
	}

	if err := h.app.Repositories.Organization.SoftDelete(orgID); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Organization deleted"})
}
