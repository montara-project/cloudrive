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

	// Dependencies Injection
	application := &app.Application{
		Config:       cfg,
		Logger:       logger,
		Repositories: repositories.New(db, &cfg.App),
		Services: services.Services{
			Email: services.EmailService{Config: cfg.Resend},
		},
	}

	if err := serve(application); err != nil {
		logger.Error("failed to start server", "error", err.Error())
		os.Exit(1)
	}
}
