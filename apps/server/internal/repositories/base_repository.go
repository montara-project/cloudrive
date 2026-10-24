package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"braces.dev/errtrace"
	"github.com/google/uuid"
	"github.com/maxrichie5/go-sqlfmt/sqlfmt"
)

type BaseRepository struct {
	DB        *sql.DB
	TableName string
	// SoftDelete marks tables that carry a "deleted_at" column, so row counts
	// can exclude soft-deleted rows.
	SoftDelete bool
}

// debugQuery logs the SQL text (never its arguments) when the logger runs at
// debug level (DEBUG=true); formatting is skipped otherwise.
func (r BaseRepository) debugQuery(query string) {
	if !slog.Default().Enabled(context.Background(), slog.LevelDebug) {
		return
	}
	slog.Debug("query", "sql", sqlfmt.PrettyFormat(query))
}

// tableName validates the configured table name. The exec helpers build SQL
// from TableName, so an empty value would produce an invalid query
// (FROM "") — fail with an explicit error instead.
func (r BaseRepository) tableName() (string, error) {
	if r.TableName == "" {
		return "", errtrace.New("repository table name is not configured")
	}

	return r.TableName, nil
}

// HasTable reports whether the repository's table exists in the public
// schema yet. Boot diagnostics use it to tell "migrations never ran" apart
// from other boot failures; a missing table is the answer to the question,
// not an error, so the result is a plain bool and any probe failure reads
// as false.
func (r BaseRepository) HasTable(ctx context.Context) bool {
	if r.DB == nil {
		return false
	}

	tableName, err := r.tableName()
	if err != nil {
		return false
	}

	query := `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`

	r.debugQuery(query)

	var count int
	if err := r.DB.QueryRowContext(ctx, query, tableName).Scan(&count); err != nil {
		return false
	}

	return count > 0
}

func (r BaseRepository) countExec(exc Executor) (int64, error) {
	tableName, err := r.tableName()
	if err != nil {
		return 0, err
	}

	query := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM "%s";
	`, tableName)

	if r.SoftDelete {
		query = fmt.Sprintf(`
		SELECT COUNT(*)
		FROM "%s"
		WHERE "deleted_at" IS NULL;
		`, tableName)
	}

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	row := exc.QueryRowContext(ctx, query)
	if row == nil {
		return 0, errtrace.New("error scanning row: no next row")
	}

	var count int64
	if err := row.Scan(&count); err != nil {
		return 0, errtrace.Errorf("error scanning row: %w", err)
	}

	return count, nil
}

func (r BaseRepository) deleteExec(exc Executor, id uuid.UUID) error {
	tableName, err := r.tableName()
	if err != nil {
		return err
	}

	query := fmt.Sprintf(`
		DELETE FROM "%s"
		WHERE "id" = $1;
	`, tableName)

	r.debugQuery(query)

	args := []any{id}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
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

func (r BaseRepository) softDeleteExec(exc Executor, id uuid.UUID) error {
	tableName, err := r.tableName()
	if err != nil {
		return err
	}

	query := fmt.Sprintf(`
		UPDATE "%s"
		SET "deleted_at" = now()
		WHERE "id" = $1;
	`, tableName)

	r.debugQuery(query)

	args := []any{id}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
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

func (r BaseRepository) restoreExec(exc Executor, id uuid.UUID) error {
	tableName, err := r.tableName()
	if err != nil {
		return err
	}

	query := fmt.Sprintf(`
		UPDATE "%s"
		SET "deleted_at" = NULL
		WHERE "id" = $1;
	`, tableName)

	r.debugQuery(query)

	args := []any{id}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
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
