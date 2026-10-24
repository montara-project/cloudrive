package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"
	"slices"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type workspaceMemberHandler struct {
	app *app.Application
}

func (h *workspaceMemberHandler) repo() *repositories.WorkspaceMemberRepository {
	return &h.app.Repositories.WorkspaceMember
}

// authorize loads the workspace and authorizes the user: any organization
// member may read; when manage is true the user must hold the organization
// owner/admin role or be a workspace admin.
func (h *workspaceMemberHandler) authorize(c fiber.Ctx, wsID, userID uuid.UUID, manage bool) (models.Workspace, error) {
	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return models.Workspace{}, err
	}

	member, err := h.app.Repositories.OrganizationMember.Get(c.Context(), workspace.OrganizationID, userID)
	if err != nil {
		return models.Workspace{}, apperr.New(apperr.KindForbidden, "You do not have access to this workspace")
	}

	if !manage {
		return workspace, nil
	}

	if member.Role == "owner" || member.Role == "admin" {
		return workspace, nil
	}

	if wsMember, err := h.repo().Get(c.Context(), wsID, userID); err == nil && wsMember.Role == "admin" {
		return workspace, nil
	}

	return models.Workspace{}, apperr.New(apperr.KindForbidden, "This action requires owner or admin role")
}

// List returns a workspace's members. Any organization member may read them.
func (h *workspaceMemberHandler) List(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	if _, err := h.authorize(c, wsID, userID, false); err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	members, err := h.repo().ListByWorkspace(c.Context(), wsID, params)
	if err != nil {
		return err
	}
	total, err := h.repo().CountByWorkspace(c.Context(), wsID)
	if err != nil {
		return err
	}

	return dtos.List(c, members, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// Add attaches an organization member to the workspace. The composite foreign
// keys reject users outside the organization with a conflict.
func (h *workspaceMemberHandler) Add(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	workspace, err := h.authorize(c, wsID, userID, true)
	if err != nil {
		return err
	}

	req := &dtos.AddMemberRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}
	if req.UserID == uuid.Nil {
		return apperr.New(apperr.KindBadRequest, "user_id is required")
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if !slices.Contains([]string{"admin", "member", "viewer"}, req.Role) {
		return apperr.New(apperr.KindBadRequest, "Role must be admin, member, or viewer")
	}

	member := models.WorkspaceMember{
		WorkspaceID:    wsID,
		OrganizationID: workspace.OrganizationID,
		UserID:         req.UserID,
		Role:           req.Role,
	}
	if member.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	if err := h.repo().Add(c.Context(), member); err != nil {
		return err
	}

	// Re-read so the response carries the DB-set timestamps.
	member, err = h.repo().Get(c.Context(), wsID, req.UserID)
	if err != nil {
		return err
	}
	return dtos.Created(c, member, "Member added")
}

// UpdateRole changes a workspace member's role.
func (h *workspaceMemberHandler) UpdateRole(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	if _, err := h.authorize(c, wsID, userID, true); err != nil {
		return err
	}

	targetID, err := pathID(c, "userId", "Invalid user id")
	if err != nil {
		return err
	}

	req := &dtos.UpdateMemberRoleRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}
	if !slices.Contains([]string{"admin", "member", "viewer"}, req.Role) {
		return apperr.New(apperr.KindBadRequest, "Role must be admin, member, or viewer")
	}

	if err := h.repo().UpdateRole(c.Context(), wsID, targetID, req.Role); err != nil {
		return err
	}

	member, err := h.repo().Get(c.Context(), wsID, targetID)
	if err != nil {
		return err
	}

	return dtos.OK(c, member)
}

// Remove detaches a user from the workspace. Members removed from the
// organization disappear automatically (database cascade).
func (h *workspaceMemberHandler) Remove(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	wsID, err := pathID(c, "wsId", "Invalid workspace id")
	if err != nil {
		return err
	}

	if _, err := h.authorize(c, wsID, userID, true); err != nil {
		return err
	}

	targetID, err := pathID(c, "userId", "Invalid user id")
	if err != nil {
		return err
	}

	if err := h.repo().Delete(c.Context(), wsID, targetID); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Member removed")
}
