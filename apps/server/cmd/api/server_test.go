package main

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

func TestSkipRateLimitExemptsSPAAssets(t *testing.T) {
	server := fiber.New()
	server.Use(limiter.New(limiter.Config{
		Max:        1,
		Expiration: time.Minute,
		Next:       skipRateLimit(false),
	}))
	server.Get("/*", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	get := func(path string) int {
		t.Helper()
		resp, err := server.Test(httptest.NewRequest(fiber.MethodGet, path, nil))
		if err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode
	}

	for range 3 {
		if code := get("/assets/index-abc.js"); code != fiber.StatusOK {
			t.Fatalf("asset: got %d, want 200", code)
		}
	}
	if code := get("/api/health"); code != fiber.StatusOK {
		t.Fatalf("first api call: got %d, want 200", code)
	}
	if code := get("/api/health"); code != fiber.StatusTooManyRequests {
		t.Fatalf("second api call: got %d, want 429", code)
	}
}
