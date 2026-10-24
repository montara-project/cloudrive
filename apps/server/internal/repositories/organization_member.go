package repositories

import (
	"context"
	"fmt"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// OrganizationMemberRepository manages organization_members.
type OrganizationMemberRepository struct {
	BaseRepository
}

const organizationMemberColumns = `
	id, organization_id, user_id, role, created_at, updated_at`

func scanOrganizationMember(row rowScanner) (models.OrganizationMember, error) {
	var m models.OrganizationMember
	err := row.Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.CreatedAt, &m.UpdatedAt)
	return m, translateNotFound("organization_members", err)
}

// organizationMemberSortColumns whitelists the columns a `sorted` value may
// order by.
var organizationMemberSortColumns = map[string]string{
	"id":         "id",
	"role":       "role",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// Add inserts a membership row. The unique constraint on
// (organization_id, user_id) surfaces as a conflict.
func (r *OrganizationMemberRepository) Add(ctx context.Context, m models.OrganizationMember) error {
	_, err := r.execContext(ctx, `
		INSERT INTO organization_members (id, organization_id, user_id, role)
		VALUES ($1, $2, $3, $4)`,
		m.ID, m.OrganizationID, m.UserID, m.Role,
	)
	return translateDuplicate(err, "this user is already a member of the organization")
}

// ListByOrganization returns one page of an organization's members, ordered
// by p.Sorted. Callers clamp the offset/limit first (see dtos.ListQuery.Clamp).
func (r *OrganizationMemberRepository) ListByOrganization(ctx context.Context, organizationID uuid.UUID, p ListParams) ([]models.OrganizationMember, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM organization_members
		WHERE organization_id = $1
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		organizationMemberColumns,
		resolveOrder(p.Sorted, organizationMemberSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, organizationID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanOrganizationMember)
}

// CountByOrganization returns how many members the organization has, for the
// response meta block.
func (r *OrganizationMemberRepository) CountByOrganization(ctx context.Context, organizationID uuid.UUID) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM organization_members WHERE organization_id = $1`
	err := r.queryRowContext(ctx, query, organizationID).Scan(&count)
	return count, err
}

// ListByUser returns every organization the user is a member of, newest first.
func (r *OrganizationMemberRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.OrganizationMember, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM organization_members
		WHERE user_id = $1
		ORDER BY created_at DESC`, organizationMemberColumns)

	rows, err := r.queryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanOrganizationMember)
}

// Get returns one membership by its (organization, user) pair.
func (r *OrganizationMemberRepository) Get(ctx context.Context, organizationID uuid.UUID, userID uuid.UUID) (models.OrganizationMember, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM organization_members
		WHERE organization_id = $1 AND user_id = $2`, organizationMemberColumns)
	return scanOrganizationMember(r.queryRowContext(ctx, query, organizationID, userID))
}

// UpdateRole changes a member's role. The database enforces a single owner
// per organization, so promoting a second member to 'owner' surfaces as a
// conflict.
func (r *OrganizationMemberRepository) UpdateRole(ctx context.Context, organizationID uuid.UUID, userID uuid.UUID, role string) error {
	res, err := r.execContext(ctx, `
		UPDATE organization_members
		SET role = $3, updated_at = now()
		WHERE organization_id = $1 AND user_id = $2`,
		organizationID, userID, role,
	)
	if err != nil {
		return translateDuplicate(err, "an organization can only have one owner")
	}
	return requireAffected(res, "organization member")
}

// Delete removes the membership row.
func (r *OrganizationMemberRepository) Delete(ctx context.Context, organizationID uuid.UUID, userID uuid.UUID) error {
	res, err := r.execContext(ctx, `
		DELETE FROM organization_members
		WHERE organization_id = $1 AND user_id = $2`,
		organizationID, userID,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization member")
}
