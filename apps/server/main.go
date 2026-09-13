package main

import (
	"log"
	"os"
	"strings"
	"sync"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

const waitlistBase = 1284

var (
	waitlistMu     sync.Mutex
	waitlistEmails = make(map[string]struct{})
)

func waitlistHandler(c fiber.Ctx) error {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"ok": false, "error": "invalid_body"})
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	_, domain, found := strings.Cut(email, "@")
	if !found || !strings.Contains(domain, ".") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"ok": false, "error": "invalid_email"})
	}

	waitlistMu.Lock()
	waitlistEmails[email] = struct{}{}
	position := waitlistBase + len(waitlistEmails)
	waitlistMu.Unlock()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok": true, "position": position})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	app := fiber.New()

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	api := app.Group("/api/v1")

	api.Get("/ping", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "pong"})
	})
	api.Post("/waitlist", waitlistHandler)

	log.Printf("server listening on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
