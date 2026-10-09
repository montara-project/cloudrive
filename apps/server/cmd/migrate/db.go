package main

import (
	"context"
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

func connectDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	// The application's tables (and golang-migrate's schema_migrations) live
	// in the public schema. A database provisioned without one — a stripped
	// template, or one where public was dropped — makes CURRENT_SCHEMA()
	// resolve to NULL and the migrate runner dies with the cryptic "no
	// schema" before a single migration runs; creating it here keeps
	// MIGRATE_ON_BOOT self-sufficient on any fresh database.
	if _, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS public"); err != nil {
		return nil, err
	}

	return db, nil
}
