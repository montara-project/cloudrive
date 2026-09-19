package models

import (
	"time"

	"github.com/google/uuid"
)

// User is the application-side mirror of Authula's user record. The ID is
// Authula's user ID, so ownership references across the app can point at the
// same identity Authula authenticates.
type User struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Email     string    `db:"email" json:"email"`
	FirstName string    `db:"first_name" json:"first_name"`
	LastName  *string   `db:"last_name" json:"last_name,omitempty"`
	Image     *string   `db:"image" json:"image,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}
