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

type OrganizationRepository struct {
	BaseRepository
}

// Create inserts an organization. The caller sets ID (uuid.NewV7) and, when
// creating the founding membership, the 'owner' role in organization_members.
func (r OrganizationRepository) Create(organization *models.Organization) error {
	return r.createExec(r.DB, organization)
}

func (r OrganizationRepository) createExec(exc Executor, organization *models.Organization) error {
	if organization.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		organization.ID = id
	}

	query := `
		INSERT INTO "organizations" ("id", "name", "slug", "logo", "created_by")
		VALUES ($1, $2, $3, $4, $5)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	args := []any{
		organization.ID,
		organization.Name,
		organization.Slug,
		organization.Logo,
		organization.CreatedBy,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := exc.QueryRowContext(ctx, query, args...).Scan(&organization.CreatedAt, &organization.UpdatedAt)
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

func (r OrganizationRepository) Get(id uuid.UUID) (*models.Organization, error) {
	return r.getExec(r.DB, id)
}

func (r OrganizationRepository) getExec(exc Executor, id uuid.UUID) (*models.Organization, error) {
	query := `
		SELECT "id", "name", "slug", "logo", "created_by", "deleted_at", "created_at", "updated_at"
		FROM "organizations"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	organization := &models.Organization{}
	err := exc.QueryRowContext(ctx, query, id).Scan(
		&organization.ID,
		&organization.Name,
		&organization.Slug,
		&organization.Logo,
		&organization.CreatedBy,
		&organization.DeletedAt,
		&organization.CreatedAt,
		&organization.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return organization, nil
}

func (r OrganizationRepository) GetBySlug(slug string) (*models.Organization, error) {
	return r.getBySlugExec(r.DB, slug)
}

func (r OrganizationRepository) getBySlugExec(exc Executor, slug string) (*models.Organization, error) {
	query := `
		SELECT "id", "name", "slug", "logo", "created_by", "deleted_at", "created_at", "updated_at"
		FROM "organizations"
		WHERE "slug" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	organization := &models.Organization{}
	err := exc.QueryRowContext(ctx, query, slug).Scan(
		&organization.ID,
		&organization.Name,
		&organization.Slug,
		&organization.Logo,
		&organization.CreatedBy,
		&organization.DeletedAt,
		&organization.CreatedAt,
		&organization.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return organization, nil
}

func (r OrganizationRepository) List(opts *QueryOptions) ([]*models.Organization, PaginationMetadata, error) {
	return r.listExec(r.DB, opts)
}

func (r OrganizationRepository) listExec(exc Executor, opts *QueryOptions) ([]*models.Organization, PaginationMetadata, error) {
	baseQuery := `
		SELECT "id", "name", "slug", "logo", "created_by", "deleted_at", "created_at", "updated_at"
		FROM "organizations"
		WHERE "deleted_at" IS NULL
	`

	var args []any
	argIndex := 1

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		`"id"`:         true,
		`"name"`:       true,
		`"slug"`:       true,
		`"created_at"`: true,
		`"updated_at"`: true,
	}

	orderBy, order, err := buildOrderBy(opts, allowedOrderByColumns, `"created_at"`)
	if err != nil {
		return nil, PaginationMetadata{}, err
	}

	queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %s %s", orderBy, order))

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

	rows, err := exc.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}
	defer rows.Close()

	var organizations []*models.Organization
	for rows.Next() {
		organization := &models.Organization{}
		if err := rows.Scan(
			&organization.ID,
			&organization.Name,
			&organization.Slug,
			&organization.Logo,
			&organization.CreatedBy,
			&organization.DeletedAt,
			&organization.CreatedAt,
			&organization.UpdatedAt,
		); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		organizations = append(organizations, organization)
	}

	count, err := r.countExec(exc)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return organizations, PaginationMetadata{Total: count}, nil
}

// Update changes the mutable columns of an organization. The slug is not
// updatable here: it is the external identifier used in URLs.
func (r OrganizationRepository) Update(id uuid.UUID, organization *models.Organization) error {
	return r.updateExec(r.DB, id, organization)
}

func (r OrganizationRepository) updateExec(exc Executor, id uuid.UUID, organization *models.Organization) error {
	query := `
		UPDATE "organizations"
		SET "name" = $1, "logo" = $2, "updated_at" = now()
		WHERE "id" = $3;
	`

	r.debugQuery(query)

	args := []any{
		organization.Name,
		organization.Logo,
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

func (r OrganizationRepository) Count() (int64, error) {
	return r.BaseRepository.countExec(r.DB)
}

func (r OrganizationRepository) Delete(id uuid.UUID) error {
	return r.BaseRepository.deleteExec(r.DB, id)
}

func (r OrganizationRepository) SoftDelete(id uuid.UUID) error {
	return r.BaseRepository.softDeleteExec(r.DB, id)
}

func (r OrganizationRepository) Restore(id uuid.UUID) error {
	return r.BaseRepository.restoreExec(r.DB, id)
}
