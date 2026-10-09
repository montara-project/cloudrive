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

// S3BucketRepository owns the s3_buckets rows — the mapping from an S3 bucket
// name (global namespace) to a connected storage account and a root prefix.
type S3BucketRepository struct {
	BaseRepository
}

func (r S3BucketRepository) Create(bucket *models.S3Bucket) error {
	if bucket.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		bucket.ID = id
	}

	query := `
		INSERT INTO "s3_buckets"
			("id", "organization_id", "workspace_id", "name", "storage_account_id", "root_prefix", "created_by")
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := r.DB.QueryRowContext(ctx, query,
		bucket.ID,
		bucket.OrganizationID,
		bucket.WorkspaceID,
		bucket.Name,
		bucket.StorageAccountID,
		bucket.RootPrefix,
		bucket.CreatedBy,
	).Scan(&bucket.CreatedAt, &bucket.UpdatedAt)
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

const s3BucketSelect = `
	SELECT "id", "organization_id", "workspace_id", "name", "storage_account_id",
	       "root_prefix", "created_by", "created_at", "updated_at"
	FROM "s3_buckets"
`

func (r S3BucketRepository) Get(id uuid.UUID) (*models.S3Bucket, error) {
	query := s3BucketSelect + ` WHERE "id" = $1;`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return r.scanBucket(r.DB.QueryRowContext(ctx, query, id))
}

// GetByName resolves a bucket name for the gateway. Bucket names are a global
// namespace, so no workspace scoping applies here — authorization is derived
// from the bucket's workspace afterwards.
func (r S3BucketRepository) GetByName(name string) (*models.S3Bucket, error) {
	query := s3BucketSelect + ` WHERE "name" = $1;`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return r.scanBucket(r.DB.QueryRowContext(ctx, query, name))
}

func (r S3BucketRepository) scanBucket(row *sql.Row) (*models.S3Bucket, error) {
	bucket := &models.S3Bucket{}
	err := row.Scan(
		&bucket.ID,
		&bucket.OrganizationID,
		&bucket.WorkspaceID,
		&bucket.Name,
		&bucket.StorageAccountID,
		&bucket.RootPrefix,
		&bucket.CreatedBy,
		&bucket.CreatedAt,
		&bucket.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return bucket, nil
}

func (r S3BucketRepository) ListByWorkspace(workspaceID uuid.UUID, opts *QueryOptions) ([]*models.S3Bucket, PaginationMetadata, error) {
	baseQuery := s3BucketSelect + `
		WHERE "workspace_id" = $1
	`

	var args []any
	argIndex := 2

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Whitelist of allowed columns for ORDER BY to prevent SQL injection
	allowedOrderByColumns := map[string]bool{
		"id":         true,
		"name":       true,
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

	rows, err := r.DB.QueryContext(ctx, query, append([]any{workspaceID}, args...)...)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}
	defer rows.Close()

	var buckets []*models.S3Bucket
	for rows.Next() {
		bucket := &models.S3Bucket{}
		if err := rows.Scan(
			&bucket.ID,
			&bucket.OrganizationID,
			&bucket.WorkspaceID,
			&bucket.Name,
			&bucket.StorageAccountID,
			&bucket.RootPrefix,
			&bucket.CreatedBy,
			&bucket.CreatedAt,
			&bucket.UpdatedAt,
		); err != nil {
			return nil, PaginationMetadata{}, errtrace.Errorf("error scanning row: %w", err)
		}
		buckets = append(buckets, bucket)
	}

	count, err := r.countByWorkspace(r.DB, workspaceID)
	if err != nil {
		return nil, PaginationMetadata{}, errtrace.Wrap(err)
	}

	return buckets, PaginationMetadata{Total: count}, nil
}

// Delete removes the bucket mapping. Objects in the backing storage account
// are untouched.
func (r S3BucketRepository) Delete(id uuid.UUID) error {
	query := `
		DELETE FROM "s3_buckets"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := r.DB.ExecContext(ctx, query, id)
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

func (r S3BucketRepository) countByWorkspace(exc Executor, workspaceID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM "s3_buckets"
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
