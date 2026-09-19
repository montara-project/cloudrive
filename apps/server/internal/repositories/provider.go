package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"cloudrive/server/internal/models"

	"braces.dev/errtrace"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type ProviderRepository struct {
	BaseRepository
}

func (r ProviderRepository) Count() (int64, error) {
	return r.BaseRepository.countExec(r.DB)
}

func (r ProviderRepository) List(opts *QueryOptions) ([]*models.Provider, PaginationMetadata, error) {
	return r.listExec(r.DB, opts)
}

func (r ProviderRepository) listExec(exc Executor, opts *QueryOptions) ([]*models.Provider, PaginationMetadata, error) {
	selectFields := `"id", "name", "created_at", "updated_at"`
	baseQuery := fmt.Sprintf(`
		SELECT %s
		FROM "providers"
		WHERE "deleted_at" IS NULL
	`, selectFields)

	var args []any
	argIndex := 1

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		`"id"`:         true,
		`"name"`:       true,
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

	var providers []*models.Provider
	for rows.Next() {
		provider := &models.Provider{}
		if err := rows.Scan(&provider.ID, &provider.Name, &provider.CreatedAt, &provider.UpdatedAt); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		providers = append(providers, provider)
	}

	count, err := r.countExec(exc)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return providers, PaginationMetadata{Total: count}, nil
}

func (r ProviderRepository) Get(id uuid.UUID) (*models.Provider, error) {
	return r.getExec(r.DB, id)
}

func (r ProviderRepository) getExec(exc Executor, id uuid.UUID) (*models.Provider, error) {
	query := `
		SELECT "id", "name", "created_at", "updated_at"
		FROM "providers"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	provider := &models.Provider{}
	err := exc.QueryRowContext(ctx, query, id).Scan(&provider.ID, &provider.Name, &provider.CreatedAt, &provider.UpdatedAt)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return provider, nil
}

func (r ProviderRepository) Insert(providers ...*models.Provider) error {
	return r.insertExec(r.DB, providers...)
}

func (r ProviderRepository) insertExec(exc Executor, providers ...*models.Provider) error {
	if len(providers) == 0 {
		return nil
	}

	columns := []string{"id", "name"}

	valueStrings := make([]string, 0, len(providers))
	valueArgs := make([]any, 0, len(providers)*len(columns))

	for i, provider := range providers {
		values := []any{provider.ID, provider.Name}

		placeholders := make([]string, 0, len(values))
		for j := range columns {
			placeholders = append(placeholders, "$"+strconv.Itoa(i*len(columns)+j+1))
		}

		valueStrings = append(valueStrings, fmt.Sprintf("(%s)", strings.Join(placeholders, ",")))
		valueArgs = append(valueArgs, values...)
	}

	query := fmt.Sprintf(`
		INSERT INTO "providers" (%s)
		VALUES %s
		RETURNING "id", "created_at", "updated_at";
	`, strings.Join(columns[:], ", "), strings.Join(valueStrings, ", "))

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := exc.QueryContext(ctx, query, valueArgs...)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok {
			if pqErr.Code == "23505" {
				return errtrace.Wrap(ErrInsertDuplicate)
			}
		}
		return errtrace.Wrap(err)
	}
	defer rows.Close()

	for _, provider := range providers {
		if !rows.Next() {
			return errtrace.New("error scanning row: no next row")
		}

		if err := rows.Scan(&provider.ID, &provider.CreatedAt, &provider.UpdatedAt); err != nil {
			return errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return nil
}

func (r ProviderRepository) Update(id uuid.UUID, provider *models.Provider) error {
	return r.updateExec(r.DB, id, provider)
}

func (r ProviderRepository) updateExec(exc Executor, id uuid.UUID, provider *models.Provider) error {
	query := `
		UPDATE "providers"
		SET "name" = $1, "updated_at" = now()
		WHERE "id" = $2;
	`

	r.debugQuery(query)

	args := []any{
		provider.Name,
		id,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
	if err != nil {
		return err
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

func (r ProviderRepository) Delete(id uuid.UUID) error {
	return r.BaseRepository.deleteExec(r.DB, id)
}

func (r ProviderRepository) SoftDelete(id uuid.UUID) error {
	return r.BaseRepository.softDeleteExec(r.DB, id)
}

func (r ProviderRepository) Restore(id uuid.UUID) error {
	return r.BaseRepository.restoreExec(r.DB, id)
}
