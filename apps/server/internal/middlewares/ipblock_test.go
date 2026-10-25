package middlewares

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
)

func newIPBlockApp(t *testing.T, cfg IPBlockConfig) func(ip, path string) int {
	t.Helper()
	cfg.IsFailure = func(c fiber.Ctx) bool { return c.Response().StatusCode() == fiber.StatusUnauthorized }
	cfg.Denied = func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusForbidden) }
	block, err := IPBlock(cfg)
	if err != nil {
		t.Fatal(err)
	}

	server := fiber.New(fiber.Config{
		ProxyHeader:        "X-Forwarded-For",
		EnableIPValidation: true,
		TrustProxy:         true,
		TrustProxyConfig:   fiber.TrustProxyConfig{Proxies: []string{"0.0.0.0"}},
	})
	server.Use(block)
	server.Get("/fail", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusUnauthorized) })
	server.Get("/ok", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	return func(ip, path string) int {
		t.Helper()
		req := httptest.NewRequest(fiber.MethodGet, path, nil)
		req.Header.Set("X-Forwarded-For", ip)
		resp, err := server.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode
	}
}

func TestIPBlockStaticList(t *testing.T) {
	get := newIPBlockApp(t, IPBlockConfig{Blocked: []string{"203.0.113.0/24", "198.51.100.7"}})

	for ip, want := range map[string]int{
		"203.0.113.9":  fiber.StatusForbidden,
		"198.51.100.7": fiber.StatusForbidden,
		"198.51.100.8": fiber.StatusOK,
	} {
		if got := get(ip, "/ok"); got != want {
			t.Errorf("%s: got %d, want %d", ip, got, want)
		}
	}
}

func TestIPBlockAutoBlocksBruteForce(t *testing.T) {
	get := newIPBlockApp(t, IPBlockConfig{
		Exempt:      []string{"192.0.2.1"},
		MaxFailures: 3,
		Duration:    200 * time.Millisecond,
	})
	attacker, other, proxy := "203.0.113.5", "203.0.113.6", "192.0.2.1"

	for range 3 {
		if got := get(attacker, "/fail"); got != fiber.StatusUnauthorized {
			t.Fatalf("attempt: got %d, want 401", got)
		}
		get(proxy, "/fail")
	}
	if got := get(attacker, "/ok"); got != fiber.StatusForbidden {
		t.Fatalf("attacker after %d failures: got %d, want 403", 3, got)
	}
	if got := get(other, "/ok"); got != fiber.StatusOK {
		t.Fatalf("other client: got %d, want 200", got)
	}
	if got := get(proxy, "/ok"); got != fiber.StatusOK {
		t.Fatalf("exempt proxy: got %d, want 200", got)
	}

	time.Sleep(250 * time.Millisecond)
	if got := get(attacker, "/ok"); got != fiber.StatusOK {
		t.Fatalf("attacker after the block expired: got %d, want 200", got)
	}
}

func TestIPBlockRejectsBadConfig(t *testing.T) {
	if _, err := IPBlock(IPBlockConfig{Blocked: []string{"not-an-ip"}}); err == nil {
		t.Error("invalid blocked entry: want an error")
	}
	if _, err := IPBlock(IPBlockConfig{MaxFailures: 5}); err == nil {
		t.Error("auto-blocking without duration: want an error")
	}
}
