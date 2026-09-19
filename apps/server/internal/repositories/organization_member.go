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

type OrganizationMemberRepository struct {
	BaseRepository
}

// Add inserts a membership row. The unique constraint on
// (organization_id, user_id) and the partial unique index on the 'owner' role
// surface as ErrInsertDuplicate.
func (r OrganizationMemberRepository) Add(member *models.OrganizationMember) error {
	return r.addExec(r.DB, member)
}

func (r OrganizationMemberRepository) addExec(exc Executor, member *models.OrganizationMember) error {
	if member.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		member.ID = id
	}

	query := `
		INSERT INTO "organization_members" ("id", "organization_id", "user_id", "role")
		VALUES ($1, $2, $3, $4)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	args := []any{
		member.ID,
		member.OrganizationID,
		member.UserID,
		member.Role,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := exc.QueryRowContext(ctx, query, args...).Scan(&member.CreatedAt, &member.UpdatedAt)
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

func (r OrganizationMemberRepository) Get(organizationID uuid.UUID, userID uuid.UUID) (*models.OrganizationMember, error) {
	return r.getExec(r.DB, organizationID, userID)
}

func (r OrganizationMemberRepository) getExec(exc Executor, organizationID uuid.UUID, userID uuid.UUID) (*models.OrganizationMember, error) {
	query := `
		SELECT "id", "organization_id", "user_id", "role", "created_at", "updated_at"
		FROM "organization_members"
		WHERE "organization_id" = $1 AND "user_id" = $2;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	member := &models.OrganizationMember{}
	err := exc.QueryRowContext(ctx, query, organizationID, userID).Scan(
		&member.ID,
		&member.OrganizationID,
		&member.UserID,
		&member.Role,
		&member.CreatedAt,
		&member.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return member, nil
}

func (r OrganizationMemberRepository) ListByOrganization(organizationID uuid.UUID, opts *QueryOptions) ([]*models.OrganizationMember, PaginationMetadata, error) {
	return r.listByOrganizationExec(r.DB, organizationID, opts)
}

func (r OrganizationMemberRepository) listByOrganizationExec(exc Executor, organizationID uuid.UUID, opts *QueryOptions) ([]*models.OrganizationMember, PaginationMetadata, error) {
	baseQuery := `
		SELECT "id", "organization_id", "user_id", "role", "created_at", "updated_at"
		FROM "organization_members"
		WHERE "organization_id" = $1
	`

	var args []any
	argIndex := 2

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		"id":         true,
		"role":       true,
		"created_at": true,
		"updated_at": true,
	}

	orderBy, order, err := buildOrderBy(opts, allowedOrderByColumns, `"created_at"`)
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

	var members []*models.OrganizationMember
	for rows.Next() {
		member := &models.OrganizationMember{}
		if err := rows.Scan(
			&member.ID,
			&member.OrganizationID,
			&member.UserID,
			&member.Role,
			&member.CreatedAt,
			&member.UpdatedAt,
		); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		members = append(members, member)
	}

	count, err := r.countByOrganizationExec(exc, organizationID)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return members, PaginationMetadata{Total: count}, nil
}

func (r OrganizationMemberRepository) ListByUser(userID uuid.UUID) ([]*models.OrganizationMember, error) {
	return r.listByUserExec(r.DB, userID)
}

func (r OrganizationMemberRepository) listByUserExec(exc Executor, userID uuid.UUID) ([]*models.OrganizationMember, error) {
	query := `
		SELECT "id", "organization_id", "user_id", "role", "created_at", "updated_at"
		FROM "organization_members"
		WHERE "user_id" = $1
		ORDER BY "created_at" DESC;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := exc.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, errtrace.Wrap(err)
	}
	defer rows.Close()

	var members []*models.OrganizationMember
	for rows.Next() {
		member := &models.OrganizationMember{}
		if err := rows.Scan(
			&member.ID,
			&member.OrganizationID,
			&member.UserID,
			&member.Role,
			&member.CreatedAt,
			&member.UpdatedAt,
		); err != nil {
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
		members = append(members, member)
	}

	return members, nil
}

// UpdateRole changes a member's role. The database enforces a single owner, so
// promoting a second member to 'owner' fails with ErrInsertDuplicate.
func (r OrganizationMemberRepository) UpdateRole(organizationID uuid.UUID, userID uuid.UUID, role string) error {
	return r.updateRoleExec(r.DB, organizationID, userID, role)
}

func (r OrganizationMemberRepository) updateRoleExec(exc Executor, organizationID uuid.UUID, userID uuid.UUID, role string) error {
	query := `
		UPDATE "organization_members"
		SET "role" = $1, "updated_at" = now()
		WHERE "organization_id" = $2 AND "user_id" = $3;
	`

	r.debugQuery(query)

	args := []any{
		role,
		organizationID,
		userID,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok {
			if pqErr.Code == "23505" {
				return errtrace.Wrap(ErrInsertDuplicate)
			}
		}
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

func (r OrganizationMemberRepository) Delete(organizationID uuid.UUID, userID uuid.UUID) error {
	return r.deleteExec(r.DB, organizationID, userID)
}

func (r OrganizationMemberRepository) deleteExec(exc Executor, organizationID uuid.UUID, userID uuid.UUID) error {
	query := `
		DELETE FROM "organization_members"
		WHERE "organization_id" = $1 AND "user_id" = $2;
	`

	r.debugQuery(query)

	args := []any{
		organizationID,
		userID,
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
		return ErrRecordNotFound
	}

	return nil
}

func (r OrganizationMemberRepository) countByOrganizationExec(exc Executor, organizationID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM "organization_members"
		WHERE "organization_id" = $1;
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
