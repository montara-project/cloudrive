package repositories

import (
	"context"
	"fmt"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// UserRepository manages the public mirror of Authula's users. Authula owns
// the source rows; this table follows them and adds the application role.
type UserRepository struct {
	BaseRepository
}

const userColumns = `
	id, email, first_name, last_name, image, role, created_at, updated_at`

func scanUser(row rowScanner) (models.User, error) {
	var u models.User
	err := row.Scan(&u.ID, &u.Email, &u.FirstName, &u.LastName, &u.Image, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	return u, translateNotFound("users", err)
}

// Upsert inserts the user or, when a row with the same id already exists,
// refreshes it from the given Authula state. Called from Authula's user
// service hooks, so it is idempotent and self-heals rows that predate the
// hook being registered. The role column is deliberately insert-only: it is
// set by the super-user seeder (SetRole), never derived from client input.
func (r *UserRepository) Upsert(ctx context.Context, u models.User) error {
	_, err := r.execContext(ctx, `
		INSERT INTO users (id, email, first_name, last_name, image, role)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			image = EXCLUDED.image,
			updated_at = now()`,
		u.ID, u.Email, u.FirstName, u.LastName, u.Image, u.Role,
	)
	return err
}

// SetRole overwrites a user's application role. Only the super-user seeder
// should call it — sign-in syncs never touch the role, so a client-supplied
// sign-up metadata value can never mint itself a privileged role.
func (r *UserRepository) SetRole(ctx context.Context, id uuid.UUID, role string) error {
	_, err := r.execContext(ctx,
		`UPDATE users SET role = $2, updated_at = now() WHERE id = $1`,
		id, role,
	)
	return err
}

// Get returns one user by id.
func (r *UserRepository) Get(ctx context.Context, id uuid.UUID) (models.User, error) {
	query := fmt.Sprintf(`SELECT %s FROM users WHERE id = $1`, userColumns)
	return scanUser(r.queryRowContext(ctx, query, id))
}

// GetByEmail returns one user by email address.
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (models.User, error) {
	query := fmt.Sprintf(`SELECT %s FROM users WHERE email = $1`, userColumns)
	return scanUser(r.queryRowContext(ctx, query, email))
}
