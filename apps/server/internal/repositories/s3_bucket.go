package repositories

import (
	"context"
	"fmt"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// S3BucketRepository owns the s3_buckets rows — the mapping from an S3 bucket
// name (global namespace) to a connected storage account and a root prefix.
type S3BucketRepository struct {
	BaseRepository
}

const s3BucketColumns = `
	id, organization_id, workspace_id, name, storage_account_id,
	root_prefix, created_by, created_at, updated_at`

func scanS3Bucket(row rowScanner) (models.S3Bucket, error) {
	var b models.S3Bucket
	err := row.Scan(&b.ID, &b.OrganizationID, &b.WorkspaceID, &b.Name, &b.StorageAccountID,
		&b.RootPrefix, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt)
	return b, translateNotFound("s3_buckets", err)
}

// s3BucketSortColumns whitelists the columns a `sorted` value may order by.
var s3BucketSortColumns = map[string]string{
	"id":         "id",
	"name":       "name",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// Create inserts a bucket mapping. The bucket name is globally unique, so a
// collision surfaces as a conflict.
func (r *S3BucketRepository) Create(ctx context.Context, bucket models.S3Bucket) error {
	_, err := r.execContext(ctx, `
		INSERT INTO s3_buckets
			(id, organization_id, workspace_id, name, storage_account_id, root_prefix, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		bucket.ID, bucket.OrganizationID, bucket.WorkspaceID, bucket.Name,
		bucket.StorageAccountID, bucket.RootPrefix, bucket.CreatedBy,
	)
	return translateDuplicate(err, "an S3 bucket with this name already exists")
}

// Get returns one bucket mapping by id.
func (r *S3BucketRepository) Get(ctx context.Context, id uuid.UUID) (models.S3Bucket, error) {
	query := fmt.Sprintf(`SELECT %s FROM s3_buckets WHERE id = $1`, s3BucketColumns)
	return scanS3Bucket(r.queryRowContext(ctx, query, id))
}

// GetByName resolves a bucket name for the gateway. Bucket names are a global
// namespace, so no workspace scoping applies here — authorization is derived
// from the bucket's workspace afterwards.
func (r *S3BucketRepository) GetByName(ctx context.Context, name string) (models.S3Bucket, error) {
	query := fmt.Sprintf(`SELECT %s FROM s3_buckets WHERE name = $1`, s3BucketColumns)
	return scanS3Bucket(r.queryRowContext(ctx, query, name))
}

// ListByWorkspace returns one page of a workspace's bucket mappings, ordered
// by p.Sorted. Callers clamp the offset/limit first (see
// dtos.ListQuery.Clamp).
func (r *S3BucketRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, p ListParams) ([]models.S3Bucket, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM s3_buckets
		WHERE workspace_id = $1
		ORDER BY %s
		LIMIT $2 OFFSET $3`,
		s3BucketColumns,
		resolveOrder(p.Sorted, s3BucketSortColumns, "created_at DESC"))

	rows, err := r.queryContext(ctx, query, workspaceID, p.Limit, p.Offset)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanS3Bucket)
}

// CountByWorkspace returns how many bucket mappings the workspace has, for
// the response meta block.
func (r *S3BucketRepository) CountByWorkspace(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	var count int64
	query := `SELECT COUNT(*) FROM s3_buckets WHERE workspace_id = $1`
	err := r.queryRowContext(ctx, query, workspaceID).Scan(&count)
	return count, err
}

// Delete removes the bucket mapping. Objects in the backing storage account
// are untouched.
func (r *S3BucketRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM s3_buckets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "s3 bucket")
}
