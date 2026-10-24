package lib

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
)

// OpenDB opens a PostgreSQL pool and verifies it with a ping, so a bad DSN
// fails at startup rather than on the first query.
func OpenDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

// TxBeginner is the BeginTx surface of a *sql.DB, so WithTransaction also
// accepts the connection interfaces repositories are built against.
type TxBeginner interface {
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
}

// EnsurePublicSchema creates the public schema when it is missing. A database
// provisioned without one — a stripped template, or one where public was
// dropped — makes CURRENT_SCHEMA() resolve to NULL and the migrate runner
// dies with the cryptic "no schema" before a single migration runs; creating
// it here keeps migrate-on-boot self-sufficient on any fresh database.
func EnsurePublicSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS public")
	if err != nil {
		return fmt.Errorf("ensure public schema: %w", err)
	}
	return nil
}

// WithTransaction runs fn inside a transaction, committing on success and
// rolling back on error or panic.
func WithTransaction(ctx context.Context, db TxBeginner, fn func(*sql.Tx) error) (err error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}

	// Ensure rollback on error or panic.
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p) // propagate the panic after rollback
		}
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = fn(tx); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}
