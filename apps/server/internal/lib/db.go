package lib

import (
	"context"
	"database/sql"
	"fmt"
)

// WithTransaction runs fn inside a transaction, committing on success and
// rolling back on error or panic.
func WithTransaction(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) (err error) {
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
