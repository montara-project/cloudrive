package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-migrate/migrate/v4"

	"cloudrive/server/internal/config"
	"cloudrive/server/internal/lib"
)

func connectDB(cfg *config.ConfigDB) (*sql.DB, error) {
	db, err := lib.OpenDB(cfg.DSN)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxIdleTime(cfg.MaxIdleTime)
	return db, nil
}

// repairHint explains how to clear a dirty schema. golang-migrate marks the
// version it was attempting dirty before it runs, so that number is the failed
// migration and the last one that fully applied is one below it; forcing to the
// failed number itself would skip that migration. Below the first migration
// nothing has been applied yet, which golang-migrate writes as -1.
func repairHint(failed uint) string {
	repair := int(failed) - 1
	if repair < 1 {
		repair = -1
	}
	return fmt.Sprintf(
		"migration %d failed and left the schema dirty; fix the cause, then run "+
			"`make db/migrations/force version=%d` and start again",
		failed, repair)
}

// migrateUp applies pending migrations on a dedicated connection, because
// closing the migrator also closes the *sql.DB it was given.
func migrateUp(cfg *config.ConfigDB, logger *slog.Logger) error {
	db, err := connectDB(&config.ConfigDB{DSN: cfg.DSN, MaxOpenConns: 1, MaxIdleConns: 1})
	if err != nil {
		return fmt.Errorf("connect for migrations: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := lib.EnsurePublicSchema(ctx, db); err != nil {
		_ = db.Close()
		return err
	}

	m, err := lib.NewMigrator(db)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		// A failed migration leaves the row dirty, so report the repair
		// alongside the original cause instead of the bare driver error.
		if version, dirty, verr := m.Version(); verr == nil && dirty {
			return fmt.Errorf("%s: %w", repairHint(version), err)
		}
		var dirty migrate.ErrDirty
		if errors.As(err, &dirty) {
			return fmt.Errorf("%s: %w", repairHint(uint(dirty.Version)), err)
		}
		return fmt.Errorf("apply migrations: %w", err)
	}

	version, dirty, err := m.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("read schema version: %w", err)
	}
	if dirty {
		return errors.New(repairHint(version))
	}

	logger.Info("database schema up to date", "version", version)
	return nil
}
