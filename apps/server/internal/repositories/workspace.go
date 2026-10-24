package repositories

import (
	"context"
	"fmt"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// WorkspaceRepository manages workspaces.
type WorkspaceRepository struct {
	BaseRepository
}

const workspaceColumns = `
	id, organization_id, name, slug, description, created_by, deleted_at, created_at, updated_at`

func scanWorkspace(row rowScanner) (models.Workspace, error) {
	var w models.Workspace
	err := row.Scan(&w.ID, &w.OrganizationID, &w.Name, &w.Slug, &w.Description, &w.CreatedBy,
		&w.DeletedAt, &w.CreatedAt, &w.UpdatedAt)
	return w, translateNotFound("workspaces", err)
}

// workspaceSortColumns whitelists the columns a `sorted` value may order by.
var workspaceSortColumns = map[string]string{
	"id":         "id",
	"name":       "name",
	"slug":       "slug",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// Create inserts a workspace. The caller sets ID (uuid.NewV7) and must supply
// the owning organization: the composite unique constraint on
// (id, organization_id) keeps downstream child rows consistent.
func (r *WorkspaceRepository) Create(ctx context.Context, w models.Workspace) error {
	_, err := r.execContext(ctx, `
		INSERT INTO workspaces (id, organization_id, name, slug, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		w.ID, w.OrganizationID, w.Name, w.Slug, w.Description, w.CreatedBy,
	)
	return translateDuplicate(err, "a workspace with this slug already exists")
}

// Get returns one live workspace by id.
func (r *WorkspaceRepository) Get(ctx context.Context, id uuid.UUID) (models.Workspace, error) {
	query := fmt.Sprintf(`SELECT %s FROM workspaces WHERE id = $1 AND deleted_at IS NULL`, workspaceColumns)
	return scanWorkspace(r.queryRowContext(ctx, query, id))
}

// GetBySlug returns one workspace by its slug inside an organization.
func (r *WorkspaceRepository) GetBySlug(ctx context.Context, organizationID uuid.UUID, slug string) (models.Workspace, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM workspaces
		WHERE organization_id = $1 AND slug = $2 AND deleted_at IS NULL`, workspaceColumns)
	return scanWorkspace(r.queryRowContext(ctx, query, organizationID, slug))
}

// ListByOrganization returns one page of an organization's live workspaces,
// ordered by p.Sorted. Callers clamp the offset/limit first (see
// dtos.ListQuery.Clamp).
func (r *WorkspaceRepository) ListByOrganization(ctx context.Context, organizationID uuid.UUID, p ListParams) ([]models.Workspace, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM workspaces
		WHERE organization_id = $1 AND deleted_at IS NULL
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		workspaceColumns,
		resolveOrder(p.Sorted, workspaceSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, organizationID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanWorkspace)
}

// CountByOrganization returns how many live workspaces the organization has,
// for the response meta block.
func (r *WorkspaceRepository) CountByOrganization(ctx context.Context, organizationID uuid.UUID) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM workspaces WHERE organization_id = $1 AND deleted_at IS NULL`
	err := r.queryRowContext(ctx, query, organizationID).Scan(&count)
	return count, err
}

// Update changes the mutable columns of a workspace. The slug is not
// updatable here: it is the external identifier used in URLs.
func (r *WorkspaceRepository) Update(ctx context.Context, w models.Workspace) error {
	res, err := r.execContext(ctx, `
		UPDATE workspaces
		SET name = $2, description = $3, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		w.ID, w.Name, w.Description,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "workspace")
}

// Delete soft-removes one workspace by stamping deleted_at.
func (r *WorkspaceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE workspaces
		SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "workspace")
}

// Restore clears deleted_at on a soft-deleted workspace, returning ErrNotFound
// when the row is absent or not trashed.
func (r *WorkspaceRepository) Restore(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE workspaces
		SET deleted_at = NULL, updated_at = now()
		WHERE id = $1 AND deleted_at IS NOT NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "workspace")
}

// ForceDelete permanently removes the row, whether or not it is trashed.
// FK violations from referencing tables surface as a conflict.
func (r *WorkspaceRepository) ForceDelete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM workspaces WHERE id = $1`, id)
	if err != nil {
		return translateForeignKey(err, "workspace is still referenced by other records")
	}
	return requireAffected(res, "workspace")
}
