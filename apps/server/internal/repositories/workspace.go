package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"cloudrive/server/internal/models"

	"braces.dev/errtrace"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type WorkspaceRepository struct {
	BaseRepository
}

// Create inserts a workspace. The caller sets ID (uuid.NewV7) and must supply
// the owning organization: the composite unique constraint on
// (id, organization_id) keeps downstream child rows consistent.
func (r WorkspaceRepository) Create(workspace *models.Workspace) error {
	return r.createExec(r.DB, workspace)
}

func (r WorkspaceRepository) createExec(exc Executor, workspace *models.Workspace) error {
	if workspace.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		workspace.ID = id
	}

	query := `
		INSERT INTO "workspaces" ("id", "organization_id", "name", "slug", "description", "created_by")
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	args := []any{
		workspace.ID,
		workspace.OrganizationID,
		workspace.Name,
		workspace.Slug,
		workspace.Description,
		workspace.CreatedBy,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := exc.QueryRowContext(ctx, query, args...).Scan(&workspace.CreatedAt, &workspace.UpdatedAt)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok {
			if pqErr.Code == "23505" {
				return errtrace.Wrap(ErrInsertDuplicate)
			}
		}
		return errtrace.Errorf("error scanning row: %w", err)
	}

	return nil
}

func (r WorkspaceRepository) Get(id uuid.UUID) (*models.Workspace, error) {
	return r.getExec(r.DB, id)
}

func (r WorkspaceRepository) getExec(exc Executor, id uuid.UUID) (*models.Workspace, error) {
	query := `
		SELECT "id", "organization_id", "name", "slug", "description", "created_by", "deleted_at", "created_at", "updated_at"
		FROM "workspaces"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	workspace := &models.Workspace{}
	err := exc.QueryRowContext(ctx, query, id).Scan(
		&workspace.ID,
		&workspace.OrganizationID,
		&workspace.Name,
		&workspace.Slug,
		&workspace.Description,
		&workspace.CreatedBy,
		&workspace.DeletedAt,
		&workspace.CreatedAt,
		&workspace.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return workspace, nil
}

func (r WorkspaceRepository) GetBySlug(organizationID uuid.UUID, slug string) (*models.Workspace, error) {
	return r.getBySlugExec(r.DB, organizationID, slug)
}

func (r WorkspaceRepository) getBySlugExec(exc Executor, organizationID uuid.UUID, slug string) (*models.Workspace, error) {
	query := `
		SELECT "id", "organization_id", "name", "slug", "description", "created_by", "deleted_at", "created_at", "updated_at"
		FROM "workspaces"
		WHERE "organization_id" = $1 AND "slug" = $2;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	workspace := &models.Workspace{}
	err := exc.QueryRowContext(ctx, query, organizationID, slug).Scan(
		&workspace.ID,
		&workspace.OrganizationID,
		&workspace.Name,
		&workspace.Slug,
		&workspace.Description,
		&workspace.CreatedBy,
		&workspace.DeletedAt,
		&workspace.CreatedAt,
		&workspace.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return workspace, nil
}

func (r WorkspaceRepository) ListByOrganization(organizationID uuid.UUID, opts *QueryOptions) ([]*models.Workspace, PaginationMetadata, error) {
	return r.listByOrganizationExec(r.DB, organizationID, opts)
}

func (r WorkspaceRepository) listByOrganizationExec(exc Executor, organizationID uuid.UUID, opts *QueryOptions) ([]*models.Workspace, PaginationMetadata, error) {
	baseQuery := `
		SELECT "id", "organization_id", "name", "slug", "description", "created_by", "deleted_at", "created_at", "updated_at"
		FROM "workspaces"
		WHERE "organization_id" = $1 AND "deleted_at" IS NULL
	`

	var args []any
	argIndex := 2

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		"id":         true,
		"name":       true,
		"slug":       true,
		"created_at": true,
		"updated_at": true,
	}

	orderBy, order, err := buildOrderBy(opts, allowedOrderByColumns, "created_at")
	if err != nil {
		return nil, PaginationMetadata{}, err
	}

	queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %q %s", orderBy, order))

	if opts.Limit > 0 {
		queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", argIndex))
		args = append(args, opts.Limit)
		argIndex++
	}

	if opts.Offset > 0 {
		queryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", argIndex))
		args = append(args, opts.Offset)
		argIndex++
	}

	query := queryBuilder.String()

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := exc.QueryContext(ctx, query, append([]any{organizationID}, args...)...)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}
	defer rows.Close()

	var workspaces []*models.Workspace
	for rows.Next() {
		workspace := &models.Workspace{}
		if err := rows.Scan(
			&workspace.ID,
			&workspace.OrganizationID,
			&workspace.Name,
			&workspace.Slug,
			&workspace.Description,
			&workspace.CreatedBy,
			&workspace.DeletedAt,
			&workspace.CreatedAt,
			&workspace.UpdatedAt,
		); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		workspaces = append(workspaces, workspace)
	}

	count, err := r.countByOrganizationExec(exc, organizationID)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return workspaces, PaginationMetadata{Total: count}, nil
}

// Update changes the mutable columns of a workspace. The slug is not updatable
// here: it is the external identifier used in URLs.
func (r WorkspaceRepository) Update(id uuid.UUID, workspace *models.Workspace) error {
	return r.updateExec(r.DB, id, workspace)
}

func (r WorkspaceRepository) updateExec(exc Executor, id uuid.UUID, workspace *models.Workspace) error {
	query := `
		UPDATE "workspaces"
		SET "name" = $1, "description" = $2, "updated_at" = now()
		WHERE "id" = $3;
	`

	r.debugQuery(query)

	args := []any{
		workspace.Name,
		workspace.Description,
		id,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
	if err != nil {
		return errtrace.Wrap(err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrEditConflict
	}

	return nil
}

func (r WorkspaceRepository) Count() (int64, error) {
	return r.BaseRepository.countExec(r.DB)
}

func (r WorkspaceRepository) Delete(id uuid.UUID) error {
	return r.BaseRepository.deleteExec(r.DB, id)
}

func (r WorkspaceRepository) SoftDelete(id uuid.UUID) error {
	return r.BaseRepository.softDeleteExec(r.DB, id)
}

func (r WorkspaceRepository) Restore(id uuid.UUID) error {
	return r.BaseRepository.restoreExec(r.DB, id)
}

func (r WorkspaceRepository) countByOrganizationExec(exc Executor, organizationID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM "workspaces"
		WHERE "organization_id" = $1 AND "deleted_at" IS NULL;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var count int64
	if err := exc.QueryRowContext(ctx, query, organizationID).Scan(&count); err != nil {
		return 0, errtrace.Errorf("error scanning row: %w", err)
	}

	return count, nil
}
