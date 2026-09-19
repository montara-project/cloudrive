package main

import (
	"log/slog"
	"os"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/config"
	"cloudrive/server/internal/lib/secretbox"
	"cloudrive/server/internal/repositories"
	"cloudrive/server/internal/services"
)

func main() {
	var cfg config.Config
	parseFlag(&cfg)

	loggerLevel := slog.LevelInfo

	if cfg.App.Debug {
		loggerLevel = slog.LevelDebug
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: loggerLevel,
	}))

	db, err := connectDB(&cfg.DB)
	if err != nil {
		logger.Error("failed to connect to database", "error", err.Error())
		os.Exit(1)
	}
	defer db.Close()

	// The credential vault seals provider credentials before they reach the
	// database; a missing or malformed key spec must stop the startup.
	box, err := secretbox.NewSecretBox(cfg.Storage.CredentialsKeys)
	if err != nil {
		logger.Error("failed to initialize provider credential encryption", "error", err.Error())
		os.Exit(1)
	}

	// Authula gets its own connection resolving to the dedicated authula
	// schema; its core and plugin migrations run inside newAuthula.
	authulaDB, err := newAuthulaDB(cfg)
	if err != nil {
		logger.Error("failed to prepare authula database", "error", err.Error())
		os.Exit(1)
	}
	defer authulaDB.Close()

	// Dependencies Injection
	application := &app.Application{
		Config:       cfg,
		Logger:       logger,
		Repositories: repositories.New(db, &cfg.App, box),
		Services: services.Services{
			Email: services.EmailService{AppName: cfg.App.Name, Config: cfg.Resend},
		},
	}
	application.Auth = newAuthula(application, authulaDB)

	if err := ensureSuperUser(application); err != nil {
		application.Logger.Error("failed to ensure super user", "error", err.Error())

		// First boot on a fresh database (typical in containers) fails on
		// missing application tables. Diagnose the failure and, when
		// MIGRATE_ON_BOOT is enabled, recover by applying migrations once.
		diagnoseBootFailure(application, err)

		if recoverWithMigrations(application, err) {
			if err := ensureSuperUser(application); err != nil {
				application.Logger.Error("super user seeding still failing after on-boot migrations", "error", err.Error())
				os.Exit(1)
			}
			application.Logger.Info("first boot recovered: migrations applied and super user seeded")
		} else {
			os.Exit(1)
		}
	}

	if err := serve(application); err != nil {
		logger.Error("failed to start server", "error", err.Error())
		os.Exit(1)
	}
}
