package main

import (
	"context"
	"errors"
	"os"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/lib/bootdiag"

	"github.com/jackc/pgx/v5/pgconn"
)

// diagnoseBootFailure reports a structured diagnosis of a failed boot using
// TypeSafe's Jev model when TYPESAFE_API_KEY is configured. Without a key it
// degrades to the deterministic remediation hint, so first-run failures stay
// actionable in both modes.
func diagnoseBootFailure(application *app.Application, bootErr error) {
	if application.Config.Diag.TypesafeAPIKey == "" {
		application.Logger.Warn("boot failed (set TYPESAFE_API_KEY to enable TypeSafe boot diagnosis)",
			"hint", "if application tables are missing, run `make db/migrations/up` or set MIGRATE_ON_BOOT=true")
		return
	}

	client := bootdiag.NewClient(application.Config.Diag.TypesafeAPIKey)
	if application.Config.Diag.TypesafeAPIURL != "" {
		client.BaseURL = application.Config.Diag.TypesafeAPIURL
	}

	migrateBinary := findMigrateBinary()
	facts := bootdiag.CollectFacts(
		context.Background(),
		application.DB,
		// The schema probe is a repository call; bootdiag itself holds no SQL.
		func(ctx context.Context) bool { return application.Repositories.User.HasTable(ctx, "users") },
		bootErr,
		runningInContainer(),
		migrateBinary,
		application.Config.App.Env,
	)

	report, err := client.Diagnose(context.Background(), facts)
	if err != nil {
		application.Logger.Warn("boot diagnosis unavailable", "error", err.Error())
		return
	}

	action, remediation := report.Decide(bootdiag.DecideOptions{
		MigrateOnBoot:          application.Config.Diag.MigrateOnBoot,
		MigrateBinaryAvailable: migrateBinary != "",
	})

	application.Logger.Error("boot diagnosis",
		"root_cause", report.RootCause,
		"probabilities", report.Probabilities,
		"confidence", report.Confidence,
		"migration_will_fix", report.MigrationWillFix,
		"action", string(action),
		"remediation", remediation,
	)
}

// recoverWithMigrations implements container first-run recovery: when the
// boot failed on missing application tables (SQLSTATE 42P01) and
// MIGRATE_ON_BOOT is enabled, the embedded migrations are applied before the
// next boot attempt. Returns true only when migrations were applied, so the
// caller can retry boot once. This stays as the reactive safety net behind
// applyMigrationsOnBoot, which runs the same pass proactively before the
// schema is first used.
func recoverWithMigrations(application *app.Application, bootErr error) bool {
	if !application.Config.Diag.MigrateOnBoot || !isUndefinedTable(bootErr) {
		return false
	}

	application.Logger.Info("boot failed on missing application tables — applying migrations")

	if err := migrateUp(&application.Config.DB, application.Logger); err != nil {
		application.Logger.Error("on-boot migration failed", "error", err.Error())
		return false
	}

	return true
}

// applyMigrationsOnBoot applies the application migrations before anything
// reads or writes the schema, so a healthy first boot never has to fail into
// the recovery path above. `migrate up` is a no-op version check on an
// up-to-date database. A failing migration run is fatal: continuing would
// just guarantee the super-user seed failure next.
func applyMigrationsOnBoot(application *app.Application) {
	if !application.Config.Diag.MigrateOnBoot {
		return
	}

	application.Logger.Info("applying migrations before boot")

	if err := migrateUp(&application.Config.DB, application.Logger); err != nil {
		application.Logger.Error("on-boot migration failed", "error", err.Error())
		os.Exit(1)
	}
}

// isUndefinedTable reports whether the error is Postgres SQLSTATE 42P01 —
// the signature of querying tables that migrations have not created yet.
func isUndefinedTable(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "42P01"
}

// findMigrateBinary locates the migrate binary baked into the image
// (/app/migrate) or its development build locations. It only feeds the boot
// diagnosis report — migrations themselves run in-process from the embedded
// SQL files.
func findMigrateBinary() string {
	for _, candidate := range []string{"/app/migrate", "./bin/migrate", "./migrate"} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return ""
}

// runningInContainer detects the typical container runtime markers.
func runningInContainer() bool {
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	return os.Getenv("KUBERNETES_SERVICE_HOST") != ""
}
