package repositories

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"cloudrive/server/internal/models"

	"braces.dev/errtrace"
	"github.com/google/uuid"
)

type UserRepository struct {
	BaseRepository
}

func (r UserRepository) Get(id uuid.UUID) (*models.User, error) {
	return r.getExec(r.DB, id)
}

func (r UserRepository) getExec(exc Executor, id uuid.UUID) (*models.User, error) {
	query := `
		SELECT "id", "email", "first_name", "last_name", "image", "created_at", "updated_at"
		FROM "users"
		WHERE "id" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	user := &models.User{}
	err := exc.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.FirstName,
		&user.LastName,
		&user.Image,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return user, nil
}

func (r UserRepository) GetByEmail(email string) (*models.User, error) {
	return r.getByEmailExec(r.DB, email)
}

func (r UserRepository) getByEmailExec(exc Executor, email string) (*models.User, error) {
	query := `
		SELECT "id", "email", "first_name", "last_name", "image", "created_at", "updated_at"
		FROM "users"
		WHERE "email" = $1;
	`

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	user := &models.User{}
	err := exc.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.FirstName,
		&user.LastName,
		&user.Image,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, errtrace.Errorf("error scanning row: %w", err)
		}
	}

	return user, nil
}

// Upsert inserts the user or, when a row with the same id already exists,
// refreshes it from the given Authula state. Called from Authula's user
// service hooks, so it is idempotent and self-heals rows that predate the
// hook being registered.
func (r UserRepository) Upsert(user *models.User) error {
	return r.upsertExec(r.DB, user)
}

func (r UserRepository) upsertExec(exc Executor, user *models.User) error {
	query := `
		INSERT INTO "users" ("id", "email", "first_name", "last_name", "image")
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT ("id") DO UPDATE
		SET "email" = EXCLUDED."email",
			"first_name" = EXCLUDED."first_name",
			"last_name" = EXCLUDED."last_name",
			"image" = EXCLUDED."image",
			"updated_at" = now()
		RETURNING "created_at", "updated_at";
	`

	r.debugQuery(query)

	args := []any{
		user.ID,
		user.Email,
		user.FirstName,
		user.LastName,
		user.Image,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := exc.QueryRowContext(ctx, query, args...).Scan(&user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return errtrace.Errorf("error scanning row: %w", err)
	}

	return nil
}
