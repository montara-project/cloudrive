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

type OrganizationInvitationRepository struct {
	BaseRepository
}

// Create inserts an invitation. The caller sets ID (uuid.NewV7), a secure
// Token for the invitation link, and ExpiresAt. The partial unique index on
// (organization_id, email) where status = 'pending' surfaces a duplicate
// pending invitation as ErrInsertDuplicate.
func (r OrganizationInvitationRepository) Create(invitation *models.OrganizationInvitation) error {
	return r.createExec(r.DB, invitation)
}

func (r OrganizationInvitationRepository) createExec(exc Executor, invitation *models.OrganizationInvitation) error {
	if invitation.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		invitation.ID = id
	}

	query := `
		INSERT INTO "organization_invitations" ("id", "organization_id", "email", "role", "status", "token", "invited_by", "expires_at")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	args := []any{
		invitation.ID,
		invitation.OrganizationID,
		invitation.Email,
		invitation.Role,
		invitation.Status,
		invitation.Token,
		invitation.InvitedBy,
		invitation.ExpiresAt,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := exc.QueryRowContext(ctx, query, args...).Scan(&invitation.CreatedAt, &invitation.UpdatedAt)
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

func (r OrganizationInvitationRepository) Get(id uuid.UUID) (*models.OrganizationInvitation, error) {
	return r.getExec(r.DB, id)
}

func (r OrganizationInvitationRepository) getExec(exc Executor, id uuid.UUID) (*models.OrganizationInvitation, error) {
	query := `
		SELECT "id", "organization_id", "email", "role", "status", "token", "invited_by", "expires_at", "created_at", "updated_at"
		FROM "organization_invitations"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	invitation := &models.OrganizationInvitation{}
	err := exc.QueryRowContext(ctx, query, id).Scan(
		&invitation.ID,
		&invitation.OrganizationID,
		&invitation.Email,
		&invitation.Role,
		&invitation.Status,
		&invitation.Token,
		&invitation.InvitedBy,
		&invitation.ExpiresAt,
		&invitation.CreatedAt,
		&invitation.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return invitation, nil
}

func (r OrganizationInvitationRepository) GetByToken(token string) (*models.OrganizationInvitation, error) {
	return r.getByTokenExec(r.DB, token)
}

func (r OrganizationInvitationRepository) getByTokenExec(exc Executor, token string) (*models.OrganizationInvitation, error) {
	query := `
		SELECT "id", "organization_id", "email", "role", "status", "token", "invited_by", "expires_at", "created_at", "updated_at"
		FROM "organization_invitations"
		WHERE "token" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	invitation := &models.OrganizationInvitation{}
	err := exc.QueryRowContext(ctx, query, token).Scan(
		&invitation.ID,
		&invitation.OrganizationID,
		&invitation.Email,
		&invitation.Role,
		&invitation.Status,
		&invitation.Token,
		&invitation.InvitedBy,
		&invitation.ExpiresAt,
		&invitation.CreatedAt,
		&invitation.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return invitation, nil
}

func (r OrganizationInvitationRepository) ListByOrganization(organizationID uuid.UUID, opts *QueryOptions) ([]*models.OrganizationInvitation, PaginationMetadata, error) {
	return r.listByOrganizationExec(r.DB, organizationID, opts)
}

func (r OrganizationInvitationRepository) listByOrganizationExec(exc Executor, organizationID uuid.UUID, opts *QueryOptions) ([]*models.OrganizationInvitation, PaginationMetadata, error) {
	baseQuery := `
		SELECT "id", "organization_id", "email", "role", "status", "token", "invited_by", "expires_at", "created_at", "updated_at"
		FROM "organization_invitations"
		WHERE "organization_id" = $1
	`

	var args []any
	argIndex := 2

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		"id":         true,
		"email":      true,
		"role":       true,
		"status":     true,
		"created_at": true,
		"expires_at": true,
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

	var invitations []*models.OrganizationInvitation
	for rows.Next() {
		invitation := &models.OrganizationInvitation{}
		if err := rows.Scan(
			&invitation.ID,
			&invitation.OrganizationID,
			&invitation.Email,
			&invitation.Role,
			&invitation.Status,
			&invitation.Token,
			&invitation.InvitedBy,
			&invitation.ExpiresAt,
			&invitation.CreatedAt,
			&invitation.UpdatedAt,
		); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		invitations = append(invitations, invitation)
	}

	count, err := r.countByOrganizationExec(exc, organizationID)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return invitations, PaginationMetadata{Total: count}, nil
}

// UpdateStatus transitions an invitation between statuses
// (pending/accepted/rejected/revoked/expired).
func (r OrganizationInvitationRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.updateStatusExec(r.DB, id, status)
}

func (r OrganizationInvitationRepository) updateStatusExec(exc Executor, id uuid.UUID, status string) error {
	query := `
		UPDATE "organization_invitations"
		SET "status" = $1, "updated_at" = now()
		WHERE "id" = $2;
	`

	r.debugQuery(query)

	args := []any{
		status,
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

func (r OrganizationInvitationRepository) Delete(id uuid.UUID) error {
	return r.BaseRepository.deleteExec(r.DB, id)
}

func (r OrganizationInvitationRepository) countByOrganizationExec(exc Executor, organizationID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM "organization_invitations"
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
