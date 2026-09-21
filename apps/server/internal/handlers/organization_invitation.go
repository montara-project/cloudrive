package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// invitationExpiresIn is how long a pending invitation stays acceptable.
const invitationExpiresIn = 7 * 24 * time.Hour

type organizationInvitationHandler struct {
	app *app.Application
}

// Create invites an email address to join the organization. Requires owner or
// admin. The token is the secret carried by the invitation link.
func (h *organizationInvitationHandler) Create(c fiber.Ctx) error {
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

	req := &dtos.CreateInvitationRequest{}
	if err := bindBody(c, req); err != nil {
		return err
	}
	if req.Role == "" {
		req.Role = "member"
	}

	// Inviting someone who is already a member is a conflict, not a new row.
	if user, err := h.app.Repositories.User.GetByEmail(req.Email); err == nil {
		if _, memberErr := h.app.Repositories.OrganizationMember.Get(orgID, user.ID); memberErr == nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"message": "User is already a member of this organization",
			})
		}
	}

	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return err
	}

	invitation := &models.OrganizationInvitation{
		OrganizationID: orgID,
		Email:          req.Email,
		Role:           req.Role,
		Status:         "pending",
		Token:          hex.EncodeToString(token),
		InvitedBy:      userID,
		ExpiresAt:      time.Now().Add(invitationExpiresIn),
	}
	if err := h.app.Repositories.OrganizationInvitation.Create(invitation); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(invitation)
}

// List returns the organization's invitations. Any member may read them.
func (h *organizationInvitationHandler) List(c fiber.Ctx) error {
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

	invitations, metadata, err := h.app.Repositories.OrganizationInvitation.ListByOrganization(orgID, opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, invitations)
}

// UpdateStatus transitions an invitation (accepted/rejected by the invitee,
// revoked by the organization). Requires owner or admin.
func (h *organizationInvitationHandler) UpdateStatus(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := lib.ContextParamUUID(c, "orgId")
	if err != nil {
		return badRequest(c, "Invalid organization id")
	}

	invitationID, err := lib.ContextParamUUID(c, "invitationId")
	if err != nil {
		return badRequest(c, "Invalid invitation id")
	}

	if _, err := requireOrgMember(c, h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &dtos.UpdateInvitationRequest{}
	if err := bindBody(c, req); err != nil {
		return err
	}

	// Keep the invitation inside this organization: a mismatched pair is a 404.
	invitation, err := h.app.Repositories.OrganizationInvitation.Get(invitationID)
	if err != nil {
		return respondError(c, err)
	}
	if invitation.OrganizationID != orgID {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Invitation not found"})
	}

	if err := h.app.Repositories.OrganizationInvitation.UpdateStatus(invitationID, req.Status); err != nil {
		return respondError(c, err)
	}

	invitation.Status = req.Status
	return c.JSON(invitation)
}

// Delete removes an invitation outright. Requires owner or admin.
func (h *organizationInvitationHandler) Delete(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := lib.ContextParamUUID(c, "orgId")
	if err != nil {
		return badRequest(c, "Invalid organization id")
	}

	invitationID, err := lib.ContextParamUUID(c, "invitationId")
	if err != nil {
		return badRequest(c, "Invalid invitation id")
	}

	if _, err := requireOrgMember(c, h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	invitation, err := h.app.Repositories.OrganizationInvitation.Get(invitationID)
	if err != nil {
		return respondError(c, err)
	}
	if invitation.OrganizationID != orgID {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Invitation not found"})
	}

	if err := h.app.Repositories.OrganizationInvitation.Delete(invitationID); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Invitation deleted"})
}
