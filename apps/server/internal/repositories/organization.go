package repositories

import (
	"context"
	"database/sql"
	"fmt"

	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// OrganizationRepository manages organizations.
type OrganizationRepository struct {
	BaseRepository
}

const organizationColumns = `
	id, name, slug, logo, created_by, deleted_at, created_at, updated_at`

// organizationQualifiedColumns is organizationColumns qualified for the
// ListByUser join; the scan order matches organizationColumns.
const organizationQualifiedColumns = `
	"o"."id", "o"."name", "o"."slug", "o"."logo", "o"."created_by",
	"o"."deleted_at", "o"."created_at", "o"."updated_at"`

func scanOrganization(row rowScanner) (models.Organization, error) {
	var o models.Organization
	err := row.Scan(&o.ID, &o.Name, &o.Slug, &o.Logo, &o.CreatedBy, &o.DeletedAt, &o.CreatedAt, &o.UpdatedAt)
	return o, translateNotFound("organizations", err)
}

// organizationSortColumns whitelists the columns a `sorted` value may order by.
var organizationSortColumns = map[string]string{
	"id":         "id",
	"name":       "name",
	"slug":       "slug",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// organizationFilters builds the WHERE conditions shared by List and Count.
func organizationFilters() *whereBuilder {
	return newWhere(`deleted_at IS NULL`)
}

// Insert persists a new organization. The slug is unique, so a collision
// surfaces as a conflict.
func (r *OrganizationRepository) Insert(ctx context.Context, o models.Organization) error {
	_, err := r.execContext(ctx, `
		INSERT INTO organizations (id, name, slug, logo, created_by)
		VALUES ($1, $2, $3, $4, $5)`,
		o.ID, o.Name, o.Slug, o.Logo, o.CreatedBy,
	)
	return translateDuplicate(err, "an organization with this slug already exists")
}

// organizationQualifiedSortColumns maps the sort whitelist onto the qualified
// columns of the ListByUser join.
var organizationQualifiedSortColumns = map[string]string{
	"id":         `"o"."id"`,
	"name":       `"o"."name"`,
	"slug":       `"o"."slug"`,
	"created_at": `"o"."created_at"`,
	"updated_at": `"o"."updated_at"`,
}

// List returns one page of live organizations, ordered by p.Sorted. Callers
// clamp the offset/limit first (see dtos.ListQuery.Clamp).
func (r *OrganizationRepository) List(ctx context.Context, p ListParams) ([]models.Organization, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM organizations
		WHERE deleted_at IS NULL
		ORDER BY %s
		LIMIT $1 OFFSET $2`,
		organizationColumns,
		resolveOrder(p.Sorted, organizationSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanOrganization)
}

// Count returns how many live organizations match the List filters, for the
// response meta block.
func (r *OrganizationRepository) Count(ctx context.Context) (int64, error) {
	return r.countRows(ctx, "organizations", organizationFilters())
}

// Get returns one live organization by id.
func (r *OrganizationRepository) Get(ctx context.Context, id uuid.UUID) (models.Organization, error) {
	query := fmt.Sprintf(`SELECT %s FROM organizations WHERE id = $1 AND deleted_at IS NULL`, organizationColumns)
	return scanOrganization(r.queryRowContext(ctx, query, id))
}

// GetBySlug returns one organization by its slug.
func (r *OrganizationRepository) GetBySlug(ctx context.Context, slug string) (models.Organization, error) {
	query := fmt.Sprintf(`SELECT %s FROM organizations WHERE slug = $1 AND deleted_at IS NULL`, organizationColumns)
	return scanOrganization(r.queryRowContext(ctx, query, slug))
}

// ListByUser returns one page of the organizations the user belongs to,
// joined through organization_members.
func (r *OrganizationRepository) ListByUser(ctx context.Context, userID uuid.UUID, p ListParams) ([]models.Organization, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM organizations "o"
		JOIN organization_members "om" ON "om"."organization_id" = "o"."id"
		WHERE "om"."user_id" = $1 AND "o"."deleted_at" IS NULL
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		organizationQualifiedColumns,
		resolveOrder(p.Sorted, organizationQualifiedSortColumns, `"o"."created_at" DESC`))

	rows, err := r.queryContext(ctx, query, userID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanOrganization)
}

// CountByUser returns how many organizations the user belongs to, for the
// response meta block.
func (r *OrganizationRepository) CountByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM organizations "o"
		JOIN organization_members "om" ON "om"."organization_id" = "o"."id"
		WHERE "om"."user_id" = $1 AND "o"."deleted_at" IS NULL`

	var count int64
	err := r.queryRowContext(ctx, query, userID).Scan(&count)
	return count, err
}

// Update rewrites an organization's mutable columns. The slug is not
// updatable here: it is the external identifier used in URLs.
func (r *OrganizationRepository) Update(ctx context.Context, o models.Organization) error {
	res, err := r.execContext(ctx, `
		UPDATE organizations
		SET name = $2, logo = $3, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		o.ID, o.Name, o.Logo,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization")
}

// CreateWithOwner inserts an organization and its founding 'owner' membership
// in a single transaction, so an organization can never exist without an
// owner.
func (r *OrganizationRepository) CreateWithOwner(ctx context.Context, o models.Organization, ownerUserID uuid.UUID) error {
	db, err := r.pool()
	if err != nil {
		return err
	}
	return lib.WithTransaction(ctx, db, func(tx *sql.Tx) error {
		txRepo := OrganizationRepository{BaseRepository{DB: tx}}
		if err := txRepo.Insert(ctx, o); err != nil {
			return err
		}

		_, err := tx.ExecContext(ctx, `
			INSERT INTO organization_members (organization_id, user_id, role)
			VALUES ($1, $2, 'owner')`,
			o.ID, ownerUserID,
		)
		return translateForeignKey(err, "the organization owner does not exist")
	})
}

// Delete soft-removes one organization by stamping deleted_at.
func (r *OrganizationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE organizations
		SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization")
}

// Restore clears deleted_at on a soft-deleted organization, returning
// ErrNotFound when the row is absent or not trashed.
func (r *OrganizationRepository) Restore(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE organizations
		SET deleted_at = NULL, updated_at = now()
		WHERE id = $1 AND deleted_at IS NOT NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization")
}

// ForceDelete permanently removes the row, whether or not it is trashed.
// FK violations from referencing tables surface as a conflict.
func (r *OrganizationRepository) ForceDelete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM organizations WHERE id = $1`, id)
	if err != nil {
		return translateForeignKey(err, "organization is still referenced by other records")
	}
	return requireAffected(res, "organization")
}
