package repositories

import (
	"context"
	"fmt"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// OrganizationInvitationRepository manages organization_invitations.
type OrganizationInvitationRepository struct {
	BaseRepository
}

const organizationInvitationColumns = `
	id, organization_id, email, role, status, token, invited_by, expires_at, created_at, updated_at`

func scanOrganizationInvitation(row rowScanner) (models.OrganizationInvitation, error) {
	var i models.OrganizationInvitation
	err := row.Scan(&i.ID, &i.OrganizationID, &i.Email, &i.Role, &i.Status, &i.Token,
		&i.InvitedBy, &i.ExpiresAt, &i.CreatedAt, &i.UpdatedAt)
	return i, translateNotFound("organization_invitations", err)
}

// organizationInvitationSortColumns whitelists the columns a `sorted` value
// may order by.
var organizationInvitationSortColumns = map[string]string{
	"id":         "id",
	"email":      "email",
	"role":       "role",
	"status":     "status",
	"created_at": "created_at",
	"expires_at": "expires_at",
}

// Create inserts an invitation. The caller sets ID (uuid.NewV7), a secure
// Token for the invitation link, and ExpiresAt. The partial unique index on
// (organization_id, email) where status = 'pending' surfaces a duplicate
// pending invitation as a conflict.
func (r *OrganizationInvitationRepository) Create(ctx context.Context, i models.OrganizationInvitation) error {
	_, err := r.execContext(ctx, `
		INSERT INTO organization_invitations (id, organization_id, email, role, status, token, invited_by, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		i.ID, i.OrganizationID, i.Email, i.Role, i.Status, i.Token, i.InvitedBy, i.ExpiresAt,
	)
	return translateDuplicate(err, "a pending invitation for this email already exists")
}

// Get returns one invitation by id.
func (r *OrganizationInvitationRepository) Get(ctx context.Context, id uuid.UUID) (models.OrganizationInvitation, error) {
	query := fmt.Sprintf(`SELECT %s FROM organization_invitations WHERE id = $1`, organizationInvitationColumns)
	return scanOrganizationInvitation(r.queryRowContext(ctx, query, id))
}

// GetByToken returns one invitation by its link token.
func (r *OrganizationInvitationRepository) GetByToken(ctx context.Context, token string) (models.OrganizationInvitation, error) {
	query := fmt.Sprintf(`SELECT %s FROM organization_invitations WHERE token = $1`, organizationInvitationColumns)
	return scanOrganizationInvitation(r.queryRowContext(ctx, query, token))
}

// ListByOrganization returns one page of an organization's invitations,
// ordered by p.Sorted. Callers clamp the offset/limit first (see
// dtos.ListQuery.Clamp).
func (r *OrganizationInvitationRepository) ListByOrganization(ctx context.Context, organizationID uuid.UUID, p ListParams) ([]models.OrganizationInvitation, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM organization_invitations
		WHERE organization_id = $1
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		organizationInvitationColumns,
		resolveOrder(p.Sorted, organizationInvitationSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, organizationID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanOrganizationInvitation)
}

// CountByOrganization returns how many invitations the organization has, for
// the response meta block.
func (r *OrganizationInvitationRepository) CountByOrganization(ctx context.Context, organizationID uuid.UUID) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM organization_invitations WHERE organization_id = $1`
	err := r.queryRowContext(ctx, query, organizationID).Scan(&count)
	return count, err
}

// UpdateStatus transitions an invitation between statuses
// (pending/accepted/rejected/revoked/expired).
func (r *OrganizationInvitationRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	res, err := r.execContext(ctx, `
		UPDATE organization_invitations
		SET status = $2, updated_at = now()
		WHERE id = $1`,
		id, status,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization invitation")
}

// Delete hard-removes the invitation row.
func (r *OrganizationInvitationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM organization_invitations WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization invitation")
}
