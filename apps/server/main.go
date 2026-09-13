package main

import (
	"fmt"
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

	contactMu    sync.Mutex
	contactCount int
)

func validEmail(email string) bool {
	_, domain, found := strings.Cut(email, "@")
	return found && strings.Contains(domain, ".")
}

func waitlistHandler(c fiber.Ctx) error {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"ok": false, "error": "invalid_body"})
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	if !validEmail(email) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"ok": false, "error": "invalid_email"})
	}

	waitlistMu.Lock()
	waitlistEmails[email] = struct{}{}
	position := waitlistBase + len(waitlistEmails)
	waitlistMu.Unlock()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok": true, "position": position})
}

func contactHandler(c fiber.Ctx) error {
	var body struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Topic   string `json:"topic"`
		Message string `json:"message"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"ok": false, "error": "invalid_body"})
	}

	if strings.TrimSpace(body.Name) == "" ||
		!validEmail(strings.ToLower(strings.TrimSpace(body.Email))) ||
		strings.TrimSpace(body.Topic) == "" ||
		len(strings.TrimSpace(body.Message)) < 10 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"ok": false, "error": "invalid_fields"})
	}

	contactMu.Lock()
	contactCount++
	ticket := fmt.Sprintf("CR-%d", 1024+contactCount)
	contactMu.Unlock()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok": true, "ticket": ticket})
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
	api.Post("/contact", contactHandler)

	log.Printf("server listening on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
