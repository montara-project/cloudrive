package repositories

import (
	"context"
	"fmt"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// WorkspaceMemberRepository manages workspace_members.
type WorkspaceMemberRepository struct {
	BaseRepository
}

const workspaceMemberColumns = `
	id, workspace_id, organization_id, user_id, role, created_at, updated_at`

func scanWorkspaceMember(row rowScanner) (models.WorkspaceMember, error) {
	var m models.WorkspaceMember
	err := row.Scan(&m.ID, &m.WorkspaceID, &m.OrganizationID, &m.UserID, &m.Role, &m.CreatedAt, &m.UpdatedAt)
	return m, translateNotFound("workspace_members", err)
}

// workspaceMemberSortColumns whitelists the columns a `sorted` value may order by.
var workspaceMemberSortColumns = map[string]string{
	"id":         "id",
	"role":       "role",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// Add inserts a workspace membership row. The composite foreign keys enforce
// the hierarchy at the database level: the workspace must belong to the given
// organization and the user must already be a member of that organization.
func (r *WorkspaceMemberRepository) Add(ctx context.Context, m models.WorkspaceMember) error {
	_, err := r.execContext(ctx, `
		INSERT INTO workspace_members (id, workspace_id, organization_id, user_id, role)
		VALUES ($1, $2, $3, $4, $5)`,
		m.ID, m.WorkspaceID, m.OrganizationID, m.UserID, m.Role,
	)
	return translateDuplicate(err, "this user is already a member of the workspace")
}

// Get returns one membership by its (workspace, user) pair.
func (r *WorkspaceMemberRepository) Get(ctx context.Context, workspaceID uuid.UUID, userID uuid.UUID) (models.WorkspaceMember, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM workspace_members
		WHERE workspace_id = $1 AND user_id = $2`, workspaceMemberColumns)
	return scanWorkspaceMember(r.queryRowContext(ctx, query, workspaceID, userID))
}

// ListByWorkspace returns one page of a workspace's members, ordered by
// p.Sorted. Callers clamp the offset/limit first (see dtos.ListQuery.Clamp).
func (r *WorkspaceMemberRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, p ListParams) ([]models.WorkspaceMember, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM workspace_members
		WHERE workspace_id = $1
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		workspaceMemberColumns,
		resolveOrder(p.Sorted, workspaceMemberSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, workspaceID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanWorkspaceMember)
}

// CountByWorkspace returns how many members the workspace has, for the
// response meta block.
func (r *WorkspaceMemberRepository) CountByWorkspace(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM workspace_members WHERE workspace_id = $1`
	err := r.queryRowContext(ctx, query, workspaceID).Scan(&count)
	return count, err
}

// ListByUser returns every workspace the user is a member of, newest first.
func (r *WorkspaceMemberRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.WorkspaceMember, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM workspace_members
		WHERE user_id = $1
		ORDER BY created_at DESC`, workspaceMemberColumns)

	rows, err := r.queryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanWorkspaceMember)
}

// UpdateRole changes a member's role.
func (r *WorkspaceMemberRepository) UpdateRole(ctx context.Context, workspaceID uuid.UUID, userID uuid.UUID, role string) error {
	res, err := r.execContext(ctx, `
		UPDATE workspace_members
		SET role = $3, updated_at = now()
		WHERE workspace_id = $1 AND user_id = $2`,
		workspaceID, userID, role,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "workspace member")
}

// Delete removes the membership row.
func (r *WorkspaceMemberRepository) Delete(ctx context.Context, workspaceID uuid.UUID, userID uuid.UUID) error {
	res, err := r.execContext(ctx, `
		DELETE FROM workspace_members
		WHERE workspace_id = $1 AND user_id = $2`,
		workspaceID, userID,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "workspace member")
}
