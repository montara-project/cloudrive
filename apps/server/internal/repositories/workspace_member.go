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

type WorkspaceMemberRepository struct {
	BaseRepository
}

// Add inserts a workspace membership row. The composite foreign keys enforce
// the hierarchy at the database level: the workspace must belong to the given
// organization and the user must already be a member of that organization.
func (r WorkspaceMemberRepository) Add(member *models.WorkspaceMember) error {
	return r.addExec(r.DB, member)
}

func (r WorkspaceMemberRepository) addExec(exc Executor, member *models.WorkspaceMember) error {
	if member.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		member.ID = id
	}

	query := `
		INSERT INTO "workspace_members" ("id", "workspace_id", "organization_id", "user_id", "role")
		VALUES ($1, $2, $3, $4, $5)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	args := []any{
		member.ID,
		member.WorkspaceID,
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

func (r WorkspaceMemberRepository) Get(workspaceID uuid.UUID, userID uuid.UUID) (*models.WorkspaceMember, error) {
	return r.getExec(r.DB, workspaceID, userID)
}

func (r WorkspaceMemberRepository) getExec(exc Executor, workspaceID uuid.UUID, userID uuid.UUID) (*models.WorkspaceMember, error) {
	query := `
		SELECT "id", "workspace_id", "organization_id", "user_id", "role", "created_at", "updated_at"
		FROM "workspace_members"
		WHERE "workspace_id" = $1 AND "user_id" = $2;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	member := &models.WorkspaceMember{}
	err := exc.QueryRowContext(ctx, query, workspaceID, userID).Scan(
		&member.ID,
		&member.WorkspaceID,
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

func (r WorkspaceMemberRepository) ListByWorkspace(workspaceID uuid.UUID, opts *QueryOptions) ([]*models.WorkspaceMember, PaginationMetadata, error) {
	return r.listByWorkspaceExec(r.DB, workspaceID, opts)
}

func (r WorkspaceMemberRepository) listByWorkspaceExec(exc Executor, workspaceID uuid.UUID, opts *QueryOptions) ([]*models.WorkspaceMember, PaginationMetadata, error) {
	baseQuery := `
		SELECT "id", "workspace_id", "organization_id", "user_id", "role", "created_at", "updated_at"
		FROM "workspace_members"
		WHERE "workspace_id" = $1
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

	rows, err := exc.QueryContext(ctx, query, append([]any{workspaceID}, args...)...)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}
	defer rows.Close()

	var members []*models.WorkspaceMember
	for rows.Next() {
		member := &models.WorkspaceMember{}
		if err := rows.Scan(
			&member.ID,
			&member.WorkspaceID,
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

	count, err := r.countByWorkspaceExec(exc, workspaceID)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return members, PaginationMetadata{Total: count}, nil
}

func (r WorkspaceMemberRepository) ListByUser(userID uuid.UUID) ([]*models.WorkspaceMember, error) {
	return r.listByUserExec(r.DB, userID)
}

func (r WorkspaceMemberRepository) listByUserExec(exc Executor, userID uuid.UUID) ([]*models.WorkspaceMember, error) {
	query := `
		SELECT "id", "workspace_id", "organization_id", "user_id", "role", "created_at", "updated_at"
		FROM "workspace_members"
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

	var members []*models.WorkspaceMember
	for rows.Next() {
		member := &models.WorkspaceMember{}
		if err := rows.Scan(
			&member.ID,
			&member.WorkspaceID,
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

func (r WorkspaceMemberRepository) UpdateRole(workspaceID uuid.UUID, userID uuid.UUID, role string) error {
	return r.updateRoleExec(r.DB, workspaceID, userID, role)
}

func (r WorkspaceMemberRepository) updateRoleExec(exc Executor, workspaceID uuid.UUID, userID uuid.UUID, role string) error {
	query := `
		UPDATE "workspace_members"
		SET "role" = $1, "updated_at" = now()
		WHERE "workspace_id" = $2 AND "user_id" = $3;
	`

	r.debugQuery(query)

	args := []any{
		role,
		workspaceID,
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
		return ErrEditConflict
	}

	return nil
}

func (r WorkspaceMemberRepository) Delete(workspaceID uuid.UUID, userID uuid.UUID) error {
	return r.deleteExec(r.DB, workspaceID, userID)
}

func (r WorkspaceMemberRepository) deleteExec(exc Executor, workspaceID uuid.UUID, userID uuid.UUID) error {
	query := `
		DELETE FROM "workspace_members"
		WHERE "workspace_id" = $1 AND "user_id" = $2;
	`

	r.debugQuery(query)

	args := []any{
		workspaceID,
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

func (r WorkspaceMemberRepository) countByWorkspaceExec(exc Executor, workspaceID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM "workspace_members"
		WHERE "workspace_id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var count int64
	if err := exc.QueryRowContext(ctx, query, workspaceID).Scan(&count); err != nil {
		return 0, errtrace.Errorf("error scanning row: %w", err)
	}

	return count, nil
}
