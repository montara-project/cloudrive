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

type organizationMemberHandler struct {
	app *app.Application
}

func (h *organizationMemberHandler) repo() *repositories.OrganizationMemberRepository {
	return &h.app.Repositories.OrganizationMember
}

// List returns the members of an organization. Any member may read it.
func (h *organizationMemberHandler) List(c fiber.Ctx) error {
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

	members, err := h.repo().ListByOrganization(c.Context(), orgID, params)
	if err != nil {
		return err
	}
	total, err := h.repo().CountByOrganization(c.Context(), orgID)
	if err != nil {
		return err
	}

	return dtos.List(c, members, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// Add attaches an existing user to the organization. Requires owner or admin.
func (h *organizationMemberHandler) Add(c fiber.Ctx) error {
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
	if !slices.Contains([]string{"admin", "member"}, req.Role) {
		return apperr.New(apperr.KindBadRequest, "Role must be admin or member (ownership is transferred, not granted)")
	}

	if _, err := h.app.Repositories.User.Get(c.Context(), req.UserID); err != nil {
		return err
	}

	member := models.OrganizationMember{
		OrganizationID: orgID,
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
	member, err = h.repo().Get(c.Context(), orgID, req.UserID)
	if err != nil {
		return err
	}
	return dtos.Created(c, member, "Member added")
}

// UpdateRole changes a member's role. The database's single-owner guarantee
// rejects a second owner with 409.
func (h *organizationMemberHandler) UpdateRole(c fiber.Ctx) error {
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

	targetID, err := pathID(c, "userId", "Invalid user id")
	if err != nil {
		return err
	}

	req := &dtos.UpdateMemberRoleRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}
	if !slices.Contains([]string{"owner", "admin", "member"}, req.Role) {
		return apperr.New(apperr.KindBadRequest, "Role must be owner, admin, or member")
	}

	// The single owner cannot be demoted; ownership moves by promoting
	// someone else first, never by demoting the current owner directly.
	target, err := h.repo().Get(c.Context(), orgID, targetID)
	if err != nil {
		return err
	}
	if target.Role == "owner" && req.Role != "owner" {
		return apperr.New(apperr.KindConflict, "Promote another member to owner before changing the current owner's role")
	}

	if err := h.repo().UpdateRole(c.Context(), orgID, targetID, req.Role); err != nil {
		return err
	}

	target.Role = req.Role
	return dtos.OK(c, target)
}

// Remove detaches a user from the organization. The owner can only be removed
// after ownership has been transferred.
func (h *organizationMemberHandler) Remove(c fiber.Ctx) error {
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

	targetID, err := pathID(c, "userId", "Invalid user id")
	if err != nil {
		return err
	}

	target, err := h.repo().Get(c.Context(), orgID, targetID)
	if err != nil {
		return err
	}
	if target.Role == "owner" {
		return apperr.New(apperr.KindConflict, "Transfer ownership before removing the owner")
	}

	if err := h.repo().Delete(c.Context(), orgID, targetID); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Member removed")
}
