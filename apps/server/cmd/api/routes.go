package main

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/handlers"
	"cloudrive/server/internal/middlewares"

	fiberadapter "github.com/Authula/authula/adapters/fiber"
	"github.com/gofiber/fiber/v3"
)

func routes(r *fiber.App, app *app.Application) {
	h := handlers.New(app)
	m := middlewares.New(app)

	r.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Hello, World!",
		})
	})

	r.Get("/health", h.Health.Check)

	// Authula serves every auth endpoint under /v1/auth (email & password,
	// magic link, OAuth2, /me, sign-out) with its own route mappings. The
	// adapter forwards the request path verbatim and Authula registers its
	// routes with the base path prepended, so the mount prefix must equal
	// authBasePath exactly.
	r.Use(authBasePath, fiberadapter.New(fiberadapter.Config{
		Handler: app.Auth.Handler(),
	}))

	// Application routes that require a session.
	r.Get("/v1/me", m.Authorization(), h.User.Me)
}
