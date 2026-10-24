package repositories

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
)

// DBTX is the surface shared by *sql.DB and *sql.Tx, so a repository can run
// against the pool or inside a transaction (see lib.WithTransaction).
type DBTX interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type BaseRepository struct {
	DB DBTX
}

// pool returns the connection pool behind the repository for transaction
// helpers: only a pool can begin a transaction, so a failed assertion means
// a transaction-starting method was reached through a tx-backed repository —
// a wiring bug, not a runtime condition.
func (r BaseRepository) pool() (*sql.DB, error) {
	db, ok := r.DB.(*sql.DB)
	if !ok {
		return nil, errors.New("transactions can only be started on the connection pool")
	}
	return db, nil
}

// execContext runs a write statement after logging it at debug level. Only
// the SQL text is logged, never its arguments.
func (r BaseRepository) execContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	slog.Debug("query", "sql", query)
	return r.DB.ExecContext(ctx, query, args...)
}

// queryContext runs a read statement after logging it.
func (r BaseRepository) queryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	slog.Debug("query", "sql", query)
	return r.DB.QueryContext(ctx, query, args...)
}

// queryRowContext runs a single-row read after logging it. A miss surfaces at
// Scan as sql.ErrNoRows, which translateNotFound maps onto a typed 404.
func (r BaseRepository) queryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	slog.Debug("query", "sql", query)
	return r.DB.QueryRowContext(ctx, query, args...)
}

// HasTable reports whether a table exists in the public schema yet. Boot
// diagnostics use it to tell "migrations never ran" apart from other boot
// failures; a missing table is the answer to the question, not an error, so
// the result is a plain bool and any probe failure reads as false. table is
// a caller-supplied literal, never request input.
func (r BaseRepository) HasTable(ctx context.Context, table string) bool {
	if r.DB == nil {
		return false
	}

	var count int
	query := `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`
	err := r.queryRowContext(ctx, query, table).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}
