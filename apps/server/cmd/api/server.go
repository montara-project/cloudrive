package main

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/connectors"
	"cloudrive/server/internal/handlers"
	"cloudrive/server/internal/services/s3"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/gofiber/fiber/v3/middleware/static"
)

func serve(app *app.Application) error {
	trustedProxies := app.Config.App.TrustedProxies

	// Fiber Configuration
	server := fiber.New(fiber.Config{
		BodyLimit:    2 * 1024 * 1024, // 2MB
		IdleTimeout:  time.Minute,
		ReadTimeout:  20 * time.Second,
		WriteTimeout: 3 * time.Minute,
		// TrustProxy requires an explicit proxy allow-list to be meaningful;
		// without one it treats every connection as a direct client, so the
		// real remote IP is used. Configure proxy addresses via TRUSTED_PROXIES.
		ProxyHeader: "X-Forwarded-For",
		TrustProxy:  len(trustedProxies) > 0,
		TrustProxyConfig: fiber.TrustProxyConfig{
			Proxies: trustedProxies,
		},
		ErrorHandler: func(c fiber.Ctx, err error) error {
			// Handler helpers that already wrote a response report
			// ErrResponded; leave the buffered response untouched.
			if errors.Is(err, handlers.ErrResponded) {
				return nil
			}

			// never echo internal error strings to the client; map Fiber's
			// typed errors to their real status and log everything else.
			code := fiber.StatusInternalServerError
			message := "Internal server error"

			var fiberErr *fiber.Error
			if errors.As(err, &fiberErr) {
				code = fiberErr.Code
				message = fiberErr.Message
			} else if app.Config.App.Env != "production" {
				message = err.Error()
			} else {
				app.Logger.Error("unhandled request error", "error", err, "path", c.Path())
			}

			return c.Status(code).JSON(fiber.Map{
				"error": message,
			})
		},
	})

	// Middleware
	server.Use(recover.New())
	server.Use(logger.New())
	server.Use(helmet.New())
	server.Use(requestid.New())
	server.Use(compress.New())

	// CORS — CORS_ALLOWED_ORIGINS is a comma-separated list; Fiber rejects the
	// whole value as one malformed origin unless it is split first.
	allowOrigins := strings.Split(app.Config.App.CORSAllowedOrigins, ",")
	for i, origin := range allowOrigins {
		allowOrigins[i] = strings.TrimSpace(origin)
	}

	server.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           3600,
	}))

	// Rate Limit. The limit is keyed on the client IP; loopback is exempted
	// only in development so local tooling is not throttled. In production the
	// exemption would let any request forwarded from a reverse proxy bypass the
	// limiter entirely, so it is disabled there.
	rateLimitConfig := limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
		LimitReached: func(c fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many requests",
			})
		},
	}

	if app.Config.App.Env != "production" {
		rateLimitConfig.Next = func(c fiber.Ctx) bool {
			return c.IP() == "127.0.0.1" || c.IP() == "::1"
		}
	}

	server.Use(limiter.New(rateLimitConfig))

	server.Use(static.New("./public"))

	// Initial Routes
	routes(server, app)

	// S3-compatible gateway: a separate Fiber app with its own listener —
	// different dialect (XML, path-style, SigV4) from the JSON REST API, so
	// middlewares like CORS/limiter/compress must not apply. Disabled when
	// S3_API_ADDR is empty.
	if app.Config.S3.APIAddr != "" {
		gateway := fiber.New(fiber.Config{
			BodyLimit: 5 * 1024 * 1024 * 1024, // 5GB: object PUT streams through
			// Body must be a stream, not a buffered copy: object PUTs are
			// proxied to the backing store as they arrive.
			StreamRequestBody: true,
			// Large uploads legitimately take a long time; only idle
			// connections are bounded.
			ReadTimeout:  10 * time.Minute,
			WriteTimeout: 10 * time.Minute,
			IdleTimeout:  time.Minute,
			ErrorHandler: func(c fiber.Ctx, err error) error {
				return c.Status(fiber.StatusInternalServerError).SendString("InternalError")
			},
		})

		gateway.Use(recover.New())

		s3.Register(gateway, &s3.Service{
			Repos: s3.RepoAdapter{
				DB:             app.Repositories.StorageAccount.DB,
				S3Credentials:  app.Repositories.S3Credential,
				S3Buckets:      app.Repositories.S3Bucket,
				StorageAccount: app.Repositories.StorageAccount,
			},
			Registry: connectors.Registry{
				GoogleClientID:     app.Config.Google.ClientID,
				GoogleClientSecret: app.Config.Google.ClientSecret,
				StagingDir:         app.Config.S3.StagingDir,
			},
		})

		go func() {
			app.Logger.Info("s3 gateway started", "addr", app.Config.S3.APIAddr)
			if err := gateway.Listen(app.Config.S3.APIAddr); err != nil {
				app.Logger.Error("failed to start s3 gateway", "error", err)
			}
		}()

		defer func() {
			if err := gateway.Shutdown(); err != nil {
				app.Logger.Error("failed to stop s3 gateway", "error", err)
			}
		}()
	}

	// Create channel to listen for interrupt signals
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	// Start server in a goroutine
	go func() {
		app.Logger.Info("server started on port", "port", app.Config.App.Port)
		listerPort := fmt.Sprintf(":%d", app.Config.App.Port)

		if err := server.Listen(listerPort); err != nil {
			app.Logger.Error("failed to start server", "error", err)
		}
	}()

	// Wait for interrupt signal
	<-c
	app.Logger.Info("Received interrupt signal, shutting down...")

	// Stop server
	if err := server.Shutdown(); err != nil {
		app.Logger.Error("failed to stop server", "error", err)
	}

	return nil
}
