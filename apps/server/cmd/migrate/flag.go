package main

import (
	"flag"
	"log"
	"os"
	"slices"
	"strings"
)

const (
	modeUp      = "up"
	modeDown    = "down"
	modeRefresh = "refresh"
)

const (
	seedProduction  = "prod"
	seedDevelopment = "dev"
)

type config struct {
	mode  string
	dbDSN string
	seed  string
}

func parseFlag(cfg *config) {
	// Defaults to DB_DSN so `make` targets and the container need no argument.
	flag.StringVar(&cfg.dbDSN, "db-dsn", os.Getenv("DB_DSN"), "PostgreSQL DSN (default $DB_DSN)")
	flag.StringVar(&cfg.seed, "seed", "", "seed")

	flag.Parse()
	validateFlag(cfg)
}

func validateFlag(cfg *config) {
	cfg.mode = flag.Arg(0)
	availableModes := []string{modeUp, modeDown, modeRefresh}

	if !slices.Contains(availableModes, cfg.mode) {
		log.Fatalf("command must be provided: %s", strings.Join(availableModes, ", "))
	}

	if cfg.dbDSN == "" {
		log.Fatal("flag --db-dsn must be provided")
	}

	if cfg.mode == modeDown && cfg.seed != "" {
		log.Fatal("flag --seed must not be provided when mode is down")
	}

	if cfg.seed != "" {
		availableSeeds := []string{seedProduction, seedDevelopment}
		if !slices.Contains(availableSeeds, cfg.seed) {
			log.Fatalf("seed must be provided: %s", strings.Join(availableSeeds, ", "))
		}
	}
}
