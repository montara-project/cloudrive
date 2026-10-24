package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/golang-migrate/migrate/v4"

	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/seeders"
)

func main() {
	var cfg config
	parseFlag(&cfg)

	// The migrator owns and closes this connection.
	migrateDB, err := lib.OpenDB(cfg.dbDSN)
	if err != nil {
		log.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := lib.EnsurePublicSchema(ctx, migrateDB); err != nil {
		log.Fatal(err)
	}

	m, err := lib.NewMigrator(migrateDB)
	if err != nil {
		log.Fatal(err)
	}
	defer m.Close()

	switch cfg.mode {
	case modeUp:
		migrateUp(m)
	case modeDown:
		migrateDown(m)
	case modeRefresh:
		migrateDown(m)
		migrateUp(m)
	case modeForce:
		forceVersion(m, cfg.version)
	}

	if cfg.seed != "" {
		// Seeding reuses the migrator's connection; the deferred m.Close()
		// closes it after this block.
		execSeeders(seeders.All(migrateDB)...)
	}

	fmt.Println("Completed")
}

func migrateUp(m *migrate.Migrate) {
	fmt.Println("Running up migrations...")
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatalf("failed to run up migrations: %v", err)
	}
}

func migrateDown(m *migrate.Migrate) {
	fmt.Println("Running down migrations...")
	if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatalf("failed to run down migrations: %v", err)
	}
}

// forceVersion clears a dirty schema_migrations row. A failed migration leaves
// the version marked dirty and every later run refuses to start, so the flag
// has to be reset by hand once the schema is known to be at that version.
func forceVersion(m *migrate.Migrate, version int) {
	fmt.Printf("Forcing schema version to %d...\n", version)
	if err := m.Force(version); err != nil {
		log.Fatalf("failed to force schema version: %v", err)
	}
}

func execSeeders(seeders ...seeders.Seeder) {
	for _, seeder := range seeders {
		fmt.Printf("Running %s seeder...\n", seeder.Name())
		if err := seeder.Seed(); err != nil {
			log.Fatalf("%s seeder failed: %v", seeder.Name(), err)
		}
	}
}
