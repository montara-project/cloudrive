package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type organizationHandler struct {
	app *app.Application
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

	organization := &models.Organization{
		Name:      req.Name,
		Slug:      req.Slug,
		CreatedBy: userID,
	}
	if req.Logo != "" {
		organization.Logo = &req.Logo
	}

	if err := h.app.Repositories.Organization.CreateWithOwner(organization, userID); err != nil {
		return dbError(err)
	}

	return dtos.Created(c, organization, "Organization created")
}

// List returns the organizations the current user belongs to.
func (h *organizationHandler) List(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	opts, q, err := pagination(c)
	if err != nil {
		return err
	}

	organizations, metadata, err := h.app.Repositories.Organization.ListByUser(userID, opts)
	if err != nil {
		return dbError(err)
	}

	return dtos.List(c, organizations, listMeta(q, metadata.Total))
}

// Get returns one organization. Any member of the organization may read it.
func (h *organizationHandler) Get(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathUUID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(h.app, orgID, userID); err != nil {
		return err
	}

	organization, err := h.app.Repositories.Organization.Get(orgID)
	if err != nil {
		return dbError(err)
	}

	return dtos.OK(c, organization)
}

// Update changes the organization profile. Requires the owner or admin role.
func (h *organizationHandler) Update(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathUUID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &dtos.UpdateOrganizationRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	current, err := h.app.Repositories.Organization.Get(orgID)
	if err != nil {
		return dbError(err)
	}

	current.Name = req.Name
	if req.Logo != "" {
		current.Logo = &req.Logo
	} else {
		current.Logo = nil
	}

	if err := h.app.Repositories.Organization.Update(orgID, current); err != nil {
		return dbError(err)
	}

	return dtos.OK(c, current)
}

// Delete soft-deletes the organization. Owner only.
func (h *organizationHandler) Delete(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathUUID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(h.app, orgID, userID, "owner"); err != nil {
		return err
	}

	if err := h.app.Repositories.Organization.SoftDelete(orgID); err != nil {
		return dbError(err)
	}

	return dtos.Message(c, fiber.StatusOK, "Organization deleted")
}
