package main

import (
	"errors"
	"fmt"
	"log"

	"cloudrive/server/internal/seeders"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"

	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	var cfg config
	parseFlag(&cfg)

	db, err := connectDB(cfg.dbDSN)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		log.Fatal(err)
	}

	migrate, err := migrate.NewWithDatabaseInstance("file://./migrations/", "postgres", driver)
	if err != nil {
		log.Fatal(err)
	}

	switch cfg.mode {
	case modeUp:
		migrateUp(migrate)
	case modeDown:
		migrateDown(migrate)
	case modeRefresh:
		migrateDown(migrate)
		migrateUp(migrate)
	}

	if cfg.seed != "" {
		execSeeders(seeders.All(db)...)
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

func execSeeders(seeders ...seeders.Seeder) {
	for _, seeder := range seeders {
		fmt.Printf("Running %s seeder...\n", seeder.Name())
		if err := seeder.Seed(); err != nil {
			log.Fatalf("%s seeder: %v", seeder.Name(), err)
		}
	}
}
