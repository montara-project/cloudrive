package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
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

	orgID, err := pathUUID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &dtos.CreateInvitationRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}
	if req.Role == "" {
		req.Role = "member"
	}

	// Inviting someone who is already a member is a conflict, not a new row.
	if user, err := h.app.Repositories.User.GetByEmail(req.Email); err == nil {
		if _, memberErr := h.app.Repositories.OrganizationMember.Get(orgID, user.ID); memberErr == nil {
			return apperr.New(apperr.KindConflict, "User is already a member of this organization")
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
		return dbError(err)
	}

	return dtos.Created(c, invitation, "Invitation created")
}

// List returns the organization's invitations. Any member may read them.
func (h *organizationInvitationHandler) List(c fiber.Ctx) error {
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

	invitations, metadata, err := h.app.Repositories.OrganizationInvitation.ListByOrganization(orgID, opts)
	if err != nil {
		return dbError(err)
	}

	return dtos.List(c, invitations, listMeta(q, metadata.Total))
}

// UpdateStatus transitions an invitation (accepted/rejected by the invitee,
// revoked by the organization). Requires owner or admin.
func (h *organizationInvitationHandler) UpdateStatus(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathUUID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	invitationID, err := pathUUID(c, "invitationId", "Invalid invitation id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &dtos.UpdateInvitationRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	// Keep the invitation inside this organization: a mismatched pair is a 404.
	invitation, err := h.app.Repositories.OrganizationInvitation.Get(invitationID)
	if err != nil {
		return dbError(err)
	}
	if invitation.OrganizationID != orgID {
		return apperr.New(apperr.KindNotFound, "Invitation not found")
	}

	if err := h.app.Repositories.OrganizationInvitation.UpdateStatus(invitationID, req.Status); err != nil {
		return dbError(err)
	}

	invitation.Status = req.Status
	return dtos.OK(c, invitation)
}

// Delete removes an invitation outright. Requires owner or admin.
func (h *organizationInvitationHandler) Delete(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathUUID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	invitationID, err := pathUUID(c, "invitationId", "Invalid invitation id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	invitation, err := h.app.Repositories.OrganizationInvitation.Get(invitationID)
	if err != nil {
		return dbError(err)
	}
	if invitation.OrganizationID != orgID {
		return apperr.New(apperr.KindNotFound, "Invitation not found")
	}

	if err := h.app.Repositories.OrganizationInvitation.Delete(invitationID); err != nil {
		return dbError(err)
	}

	return dtos.Message(c, fiber.StatusOK, "Invitation deleted")
}
