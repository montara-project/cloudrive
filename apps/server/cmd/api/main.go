package main

import (
	"log/slog"
	"os"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/config"
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
		Repositories: repositories.New(db, &cfg.App),
		Services: services.Services{
			Email: services.EmailService{AppName: cfg.App.Name, Config: cfg.Resend},
		},
	}
	application.Auth = newAuthula(application, authulaDB)

	if err := serve(application); err != nil {
		logger.Error("failed to start server", "error", err.Error())
		os.Exit(1)
	}
}
