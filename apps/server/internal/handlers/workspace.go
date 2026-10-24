package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type workspaceHandler struct {
	app *app.Application
}

func (h *workspaceHandler) repo() *repositories.WorkspaceRepository {
	return &h.app.Repositories.Workspace
}

// Create adds a workspace to an organization. Requires owner or admin.
func (h *workspaceHandler) Create(c fiber.Ctx) error {
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

	req := &dtos.CreateWorkspaceRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	workspace := models.Workspace{
		OrganizationID: orgID,
		Name:           req.Name,
		Slug:           req.Slug,
		CreatedBy:      userID,
	}
	if req.Description != "" {
		workspace.Description = &req.Description
	}
	if workspace.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	if err := h.repo().Create(c.Context(), workspace); err != nil {
		return err
	}

	// Re-read so the response carries the DB-set timestamps.
	workspace, err = h.repo().Get(c.Context(), workspace.ID)
	if err != nil {
		return err
	}
	return dtos.Created(c, workspace, "Workspace created")
}

// List returns the organization's workspaces. Any member may read them.
func (h *workspaceHandler) List(c fiber.Ctx) error {
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

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	workspaces, err := h.repo().ListByOrganization(c.Context(), orgID, params)
	if err != nil {
		return err
	}
	total, err := h.repo().CountByOrganization(c.Context(), orgID)
	if err != nil {
		return err
	}

	return dtos.List(c, workspaces, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// Get returns one workspace. Any member of the owning organization may read it.
func (h *workspaceHandler) Get(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.repo().Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID); err != nil {
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

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.repo().Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
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

	if err := h.repo().Update(c.Context(), workspace); err != nil {
		return err
	}

	workspace, err = h.repo().Get(c.Context(), wsID)
	if err != nil {
		return err
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

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.repo().Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return err
	}

	if err := h.repo().Delete(c.Context(), wsID); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Workspace deleted")
}
