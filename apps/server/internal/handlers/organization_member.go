package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type organizationMemberHandler struct {
	app *app.Application
}

// List returns the members of an organization. Any member may read it.
func (h *organizationMemberHandler) List(c fiber.Ctx) error {
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

	opts, q, err := pagination(c)
	if err != nil {
		return err
	}

	members, metadata, err := h.app.Repositories.OrganizationMember.ListByOrganization(orgID, opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, members)
}

// Add attaches an existing user to the organization. Requires owner or admin.
func (h *organizationMemberHandler) Add(c fiber.Ctx) error {
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
	if !contains([]string{"admin", "member"}, req.Role) {
		return badRequest(c, "Role must be admin or member (ownership is transferred, not granted)")
	}

	if _, err := h.app.Repositories.User.Get(req.UserID); err != nil {
		return respondError(c, err)
	}

	member := &models.OrganizationMember{
		OrganizationID: orgID,
		UserID:         req.UserID,
		Role:           req.Role,
	}
	if err := h.app.Repositories.OrganizationMember.Add(member); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(member)
}

// UpdateRole changes a member's role. The database's single-owner guarantee
// rejects a second owner with 409.
func (h *organizationMemberHandler) UpdateRole(c fiber.Ctx) error {
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

	targetID, err := lib.ContextParamUUID(c, "userId")
	if err != nil {
		return badRequest(c, "Invalid user id")
	}

	req := &dtos.UpdateMemberRoleRequest{}
	if err := bindBody(c, req); err != nil {
		return err
	}
	if !contains([]string{"owner", "admin", "member"}, req.Role) {
		return badRequest(c, "Role must be owner, admin, or member")
	}

	// The single owner cannot be demoted; ownership moves by promoting
	// someone else first, never by demoting the current owner directly.
	target, err := h.app.Repositories.OrganizationMember.Get(orgID, targetID)
	if err != nil {
		return respondError(c, err)
	}
	if target.Role == "owner" && req.Role != "owner" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"message": "Promote another member to owner before changing the current owner's role",
		})
	}

	if err := h.app.Repositories.OrganizationMember.UpdateRole(orgID, targetID, req.Role); err != nil {
		return respondError(c, err)
	}

	target.Role = req.Role
	return c.JSON(target)
}

// Remove detaches a user from the organization. The owner can only be removed
// after ownership has been transferred.
func (h *organizationMemberHandler) Remove(c fiber.Ctx) error {
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

	targetID, err := lib.ContextParamUUID(c, "userId")
	if err != nil {
		return badRequest(c, "Invalid user id")
	}

	target, err := h.app.Repositories.OrganizationMember.Get(orgID, targetID)
	if err != nil {
		return respondError(c, err)
	}
	if target.Role == "owner" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"message": "Transfer ownership before removing the owner",
		})
	}

	if err := h.app.Repositories.OrganizationMember.Delete(orgID, targetID); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Member removed"})
}
