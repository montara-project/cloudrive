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
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// invitationExpiresIn is how long a pending invitation stays acceptable.
const invitationExpiresIn = 7 * 24 * time.Hour

type organizationInvitationHandler struct {
	app *app.Application
}

func (h *organizationInvitationHandler) repo() *repositories.OrganizationInvitationRepository {
	return &h.app.Repositories.OrganizationInvitation
}

// Create invites an email address to join the organization. Requires owner or
// admin. The token is the secret carried by the invitation link.
func (h *organizationInvitationHandler) Create(c fiber.Ctx) error {
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

	req := &dtos.CreateInvitationRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}
	if req.Role == "" {
		req.Role = "member"
	}

	// Inviting someone who is already a member is a conflict, not a new row.
	if user, err := h.app.Repositories.User.GetByEmail(c.Context(), req.Email); err == nil {
		if _, memberErr := h.app.Repositories.OrganizationMember.Get(c.Context(), orgID, user.ID); memberErr == nil {
			return apperr.New(apperr.KindConflict, "User is already a member of this organization")
		}
	}

	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return err
	}

	invitation := models.OrganizationInvitation{
		OrganizationID: orgID,
		Email:          req.Email,
		Role:           req.Role,
		Status:         "pending",
		Token:          hex.EncodeToString(token),
		InvitedBy:      userID,
		ExpiresAt:      time.Now().Add(invitationExpiresIn),
	}
	if invitation.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	if err := h.repo().Create(c.Context(), invitation); err != nil {
		return err
	}

	// Re-read so the response carries the DB-set timestamps.
	invitation, err = h.repo().Get(c.Context(), invitation.ID)
	if err != nil {
		return err
	}
	return dtos.Created(c, invitation, "Invitation created")
}

// List returns the organization's invitations. Owner/admin only, and the
// secret tokens are redacted: the token is the only credential that redeems
// an invite, so a plain member reading it would be able to self-redeem an
// admin-role invite once a redemption endpoint exists.
func (h *organizationInvitationHandler) List(c fiber.Ctx) error {
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

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	invitations, err := h.repo().ListByOrganization(c.Context(), orgID, params)
	if err != nil {
		return err
	}
	total, err := h.repo().CountByOrganization(c.Context(), orgID)
	if err != nil {
		return err
	}

	for _, invitation := range invitations {
		invitation.Token = ""
	}

	return dtos.List(c, invitations, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// UpdateStatus transitions an invitation (accepted/rejected by the invitee,
// revoked by the organization). Requires owner or admin.
func (h *organizationInvitationHandler) UpdateStatus(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	orgID, err := pathID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	invitationID, err := pathID(c, "invitationId", "Invalid invitation id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	req := &dtos.UpdateInvitationRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	// Keep the invitation inside this organization: a mismatched pair is a 404.
	invitation, err := h.repo().Get(c.Context(), invitationID)
	if err != nil {
		return err
	}
	if invitation.OrganizationID != orgID {
		return apperr.New(apperr.KindNotFound, "Invitation not found")
	}

	if err := h.repo().UpdateStatus(c.Context(), invitationID, req.Status); err != nil {
		return err
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

	orgID, err := pathID(c, "orgId", "Invalid organization id")
	if err != nil {
		return err
	}

	invitationID, err := pathID(c, "invitationId", "Invalid invitation id")
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, orgID, userID, "owner", "admin"); err != nil {
		return err
	}

	invitation, err := h.repo().Get(c.Context(), invitationID)
	if err != nil {
		return err
	}
	if invitation.OrganizationID != orgID {
		return apperr.New(apperr.KindNotFound, "Invitation not found")
	}

	if err := h.repo().Delete(c.Context(), invitationID); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Invitation deleted")
}
