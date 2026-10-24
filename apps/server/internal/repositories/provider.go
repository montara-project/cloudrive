package repositories

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// ProviderRepository manages the provider catalog.
type ProviderRepository struct {
	BaseRepository
}

const providerColumns = `
	id, slug, name, protocol, auth_type, capabilities, is_active, deleted_at, created_at, updated_at`

func scanProvider(row rowScanner) (models.Provider, error) {
	var p models.Provider
	err := row.Scan(&p.ID, &p.Slug, &p.Name, &p.Protocol, &p.AuthType, &p.Capabilities,
		&p.IsActive, &p.DeletedAt, &p.CreatedAt, &p.UpdatedAt)
	return p, translateNotFound("providers", err)
}

// providerSortColumns whitelists the columns a `sorted` value may order by.
var providerSortColumns = map[string]string{
	"id":         "id",
	"slug":       "slug",
	"name":       "name",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// List returns one page of live catalog entries, ordered by p.Sorted. Callers
// clamp the offset/limit first (see dtos.ListQuery.Clamp).
func (r *ProviderRepository) List(ctx context.Context, p ListParams) ([]models.Provider, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM providers
		WHERE deleted_at IS NULL
		ORDER BY %s
		LIMIT $1 OFFSET $2`,
		providerColumns,
		resolveOrder(p.Sorted, providerSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanProvider)
}

// Count returns how many live catalog entries exist, for the response meta
// block.
func (r *ProviderRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM providers WHERE deleted_at IS NULL`
	err := r.queryRowContext(ctx, query).Scan(&count)
	return count, err
}

// Get returns one catalog entry by id.
func (r *ProviderRepository) Get(ctx context.Context, id uuid.UUID) (models.Provider, error) {
	query := fmt.Sprintf(`SELECT %s FROM providers WHERE id = $1 AND deleted_at IS NULL`, providerColumns)
	return scanProvider(r.queryRowContext(ctx, query, id))
}

// GetBySlug returns one catalog entry by its slug.
func (r *ProviderRepository) GetBySlug(ctx context.Context, slug string) (models.Provider, error) {
	query := fmt.Sprintf(`SELECT %s FROM providers WHERE slug = $1 AND deleted_at IS NULL`, providerColumns)
	return scanProvider(r.queryRowContext(ctx, query, slug))
}

// Insert batch-inserts catalog entries and returns the persisted rows with
// their surviving ids and DB-set timestamps. The slug is unique, so a
// collision surfaces as a conflict.
func (r *ProviderRepository) Insert(ctx context.Context, providers ...models.Provider) ([]models.Provider, error) {
	out := make([]models.Provider, 0, len(providers))
	if len(providers) == 0 {
		return out, nil
	}

	columns := []string{"id", "slug", "name", "protocol", "auth_type", "capabilities", "is_active"}

	valueStrings := make([]string, 0, len(providers))
	valueArgs := make([]any, 0, len(providers)*len(columns))

	for i, provider := range providers {
		if provider.ID == uuid.Nil {
			id, err := uuid.NewV7()
			if err != nil {
				return nil, fmt.Errorf("error generating id: %w", err)
			}
			provider.ID = id
		}

		// pgx encodes []byte as a bytea literal, which jsonb rejects; jsonb
		// columns are sent as their JSON text instead.
		var capabilities any
		if len(provider.Capabilities) > 0 {
			capabilities = string(provider.Capabilities)
		}

		values := []any{provider.ID, provider.Slug, provider.Name, provider.Protocol, provider.AuthType, capabilities, provider.IsActive}

		placeholders := make([]string, 0, len(values))
		for j := range columns {
			placeholders = append(placeholders, "$"+strconv.Itoa(i*len(columns)+j+1))
		}

		valueStrings = append(valueStrings, fmt.Sprintf("(%s)", strings.Join(placeholders, ",")))
		valueArgs = append(valueArgs, values...)
	}

	query := fmt.Sprintf(`
		INSERT INTO providers (%s)
		VALUES %s
		RETURNING id, created_at, updated_at`,
		strings.Join(columns, ", "), strings.Join(valueStrings, ", "))

	rows, err := r.queryContext(ctx, query, valueArgs...)
	if err != nil {
		return nil, translateDuplicate(err, "a provider with this slug already exists")
	}
	defer rows.Close()

	for _, provider := range providers {
		if !rows.Next() {
			return nil, fmt.Errorf("error scanning row: no next row")
		}
		if err := rows.Scan(&provider.ID, &provider.CreatedAt, &provider.UpdatedAt); err != nil {
			return nil, fmt.Errorf("error scanning row: %w", err)
		}
		out = append(out, provider)
	}

	return out, rows.Err()
}

// Update changes the mutable columns of a catalog entry. The slug is not
// updatable here: it is the external identifier used by integrations.
func (r *ProviderRepository) Update(ctx context.Context, p models.Provider) error {
	res, err := r.execContext(ctx, `
		UPDATE providers
		SET name = $2, is_active = $3, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		p.ID, p.Name, p.IsActive,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "provider")
}

// Delete soft-removes one catalog entry by stamping deleted_at.
func (r *ProviderRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE providers
		SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "provider")
}

// Restore clears deleted_at on a soft-deleted catalog entry, returning
// ErrNotFound when the row is absent or not trashed.
func (r *ProviderRepository) Restore(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE providers
		SET deleted_at = NULL, updated_at = now()
		WHERE id = $1 AND deleted_at IS NOT NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "provider")
}

// ForceDelete permanently removes the row, whether or not it is trashed.
// FK violations from referencing tables surface as a conflict.
func (r *ProviderRepository) ForceDelete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM providers WHERE id = $1`, id)
	if err != nil {
		return translateForeignKey(err, "provider is still referenced by other records")
	}
	return requireAffected(res, "provider")
}
