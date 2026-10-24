package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type workspaceHandler struct {
	app *app.Application
}

// Create adds a workspace to an organization. Requires owner or admin.
func (h *workspaceHandler) Create(c fiber.Ctx) error {
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

	req := &dtos.CreateWorkspaceRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	workspace := &models.Workspace{
		OrganizationID: orgID,
		Name:           req.Name,
		Slug:           req.Slug,
		CreatedBy:      userID,
	}
	if req.Description != "" {
		workspace.Description = &req.Description
	}

	if err := h.app.Repositories.Workspace.Create(workspace); err != nil {
		return dbError(err)
	}

	return dtos.Created(c, workspace, "Workspace created")
}

// List returns the organization's workspaces. Any member may read them.
func (h *workspaceHandler) List(c fiber.Ctx) error {
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

	opts, q, err := pagination(c)
	if err != nil {
		return err
	}

	workspaces, metadata, err := h.app.Repositories.Workspace.ListByOrganization(orgID, opts)
	if err != nil {
		return dbError(err)
	}

	return dtos.List(c, workspaces, listMeta(q, metadata.Total))
}

// Get returns one workspace. Any member of the owning organization may read it.
func (h *workspaceHandler) Get(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathUUID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return dbError(err)
	}

	if _, err := requireOrgMember(h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	return dtos.OK(c, workspace)
}

// Update changes the workspace profile. Requires owner or admin of the
// organization; the slug is not updatable (it is the external identifier).
func (h *workspaceHandler) Update(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathUUID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return dbError(err)
	}

	if _, err := requireOrgMember(h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &dtos.UpdateWorkspaceRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	workspace.Name = req.Name
	if req.Description != "" {
		workspace.Description = &req.Description
	} else {
		workspace.Description = nil
	}

	if err := h.app.Repositories.Workspace.Update(wsID, workspace); err != nil {
		return dbError(err)
	}

	return dtos.OK(c, workspace)
}

// Delete soft-deletes the workspace. Requires owner or admin of the
// organization.
func (h *workspaceHandler) Delete(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathUUID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return dbError(err)
	}

	if _, err := requireOrgMember(h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return err
	}

	if err := h.app.Repositories.Workspace.SoftDelete(wsID); err != nil {
		return dbError(err)
	}

	return dtos.Message(c, fiber.StatusOK, "Workspace deleted")
}
