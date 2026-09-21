package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type workspaceMemberHandler struct {
	app *app.Application
}

// authorize loads the workspace and authorizes the user: any organization
// member may read; when manage is true the user must hold the organization
// owner/admin role or be a workspace admin.
func (h *workspaceMemberHandler) authorize(c fiber.Ctx, wsID, userID uuid.UUID, manage bool) (*models.Workspace, error) {
	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return nil, respondError(c, err)
	}

	member, err := h.app.Repositories.OrganizationMember.Get(workspace.OrganizationID, userID)
	if err != nil {
		return nil, forbidden(c, "You do not have access to this workspace")
	}

	if !manage {
		return workspace, nil
	}

	if member.Role == "owner" || member.Role == "admin" {
		return workspace, nil
	}

	if wsMember, err := h.app.Repositories.WorkspaceMember.Get(wsID, userID); err == nil && wsMember.Role == "admin" {
		return workspace, nil
	}

	return nil, forbidden(c, "This action requires owner or admin role")
}

// List returns a workspace's members. Any organization member may read them.
func (h *workspaceMemberHandler) List(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	if _, err := h.authorize(c, wsID, userID, false); err != nil {
		return err
	}

	opts, q, err := pagination(c)
	if err != nil {
		return err
	}

	members, metadata, err := h.app.Repositories.WorkspaceMember.ListByWorkspace(wsID, opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, members)
}

// Add attaches an organization member to the workspace. The composite foreign
// keys reject users outside the organization with 422.
func (h *workspaceMemberHandler) Add(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	workspace, err := h.authorize(c, wsID, userID, true)
	if err != nil {
		return err
	}

	req := &dtos.AddMemberRequest{}
	if err := bindBody(c, req); err != nil {
		return err
	}
	if req.UserID == uuid.Nil {
		return badRequest(c, "user_id is required")
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if !contains([]string{"admin", "member", "viewer"}, req.Role) {
		return badRequest(c, "Role must be admin, member, or viewer")
	}

	member := &models.WorkspaceMember{
		WorkspaceID:    wsID,
		OrganizationID: workspace.OrganizationID,
		UserID:         req.UserID,
		Role:           req.Role,
	}
	if err := h.app.Repositories.WorkspaceMember.Add(member); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(member)
}

// UpdateRole changes a workspace member's role.
func (h *workspaceMemberHandler) UpdateRole(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	if _, err := h.authorize(c, wsID, userID, true); err != nil {
		return err
	}

	targetID, err := lib.ContextParamUUID(c, "userId")
	if err != nil {
		return badRequest(c, "Invalid user id")
	}

	req := &dtos.UpdateMemberRoleRequest{}
	if err := bindBody(c, req); err != nil {
		return err
	}
	if !contains([]string{"admin", "member", "viewer"}, req.Role) {
		return badRequest(c, "Role must be admin, member, or viewer")
	}

	if err := h.app.Repositories.WorkspaceMember.UpdateRole(wsID, targetID, req.Role); err != nil {
		return respondError(c, err)
	}

	member, err := h.app.Repositories.WorkspaceMember.Get(wsID, targetID)
	if err != nil {
		return respondError(c, err)
	}

	return c.JSON(member)
}

// Remove detaches a user from the workspace. Members removed from the
// organization disappear automatically (database cascade).
func (h *workspaceMemberHandler) Remove(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := lib.ContextParamUUID(c, "wsId")
	if err != nil {
		return badRequest(c, "Invalid workspace id")
	}

	if _, err := h.authorize(c, wsID, userID, true); err != nil {
		return err
	}

	targetID, err := lib.ContextParamUUID(c, "userId")
	if err != nil {
		return badRequest(c, "Invalid user id")
	}

	if err := h.app.Repositories.WorkspaceMember.Delete(wsID, targetID); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Member removed"})
}
