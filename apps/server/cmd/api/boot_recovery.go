package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"time"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/lib/bootdiag"

	"github.com/lib/pq"
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
		application.Repositories.User.DB,
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
// MIGRATE_ON_BOOT is enabled, the image's own migrate binary is executed
// against the configured database. Returns true only when migrations were
// applied, so the caller can retry boot once.
func recoverWithMigrations(application *app.Application, bootErr error) bool {
	if !application.Config.Diag.MigrateOnBoot || !isUndefinedTable(bootErr) {
		return false
	}

	binary := findMigrateBinary()
	if binary == "" {
		application.Logger.Error("MIGRATE_ON_BOOT is enabled but the migrate binary was not found")
		return false
	}

	application.Logger.Info("boot failed on missing application tables — applying migrations", "binary", binary)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, binary,
		"--db-dsn="+application.Config.DB.DSN,
		"up",
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		application.Logger.Error("on-boot migration failed", "error", err.Error())
		return false
	}

	return true
}

// isUndefinedTable reports whether the error is Postgres SQLSTATE 42P01 —
// the signature of querying tables that migrations have not created yet.
func isUndefinedTable(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "42P01"
}

// findMigrateBinary locates the migrate binary baked into the image
// (/app/migrate) or its development build locations.
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
