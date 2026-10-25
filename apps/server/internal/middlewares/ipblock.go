package middlewares

import (
	"fmt"
	"log/slog"
	"net/netip"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
)

// IPBlockConfig configures IPBlock.
type IPBlockConfig struct {
	// Blocked lists IPs/CIDRs refused outright.
	Blocked []string
	// Exempt lists IPs/CIDRs never auto-blocked: the trusted proxies. When the
	// client IP cannot be resolved past one, banning it would cut off every
	// client behind it.
	Exempt []string
	// MaxFailures failed attempts within Duration block the IP for Duration.
	// 0 disables auto-blocking.
	MaxFailures int
	Duration    time.Duration
	// IsFailure reports whether a finished request was a failed attempt at
	// guessing credentials. Keep it to those endpoints: counting every 401
	// would ban signed-out visitors and expired sessions.
	IsFailure func(c fiber.Ctx) bool
	// Denied answers a request from a blocked IP.
	Denied fiber.Handler
	Logger *slog.Logger
}

type ipFailures struct {
	count        int
	windowEnd    time.Time
	blockedUntil time.Time
}

// IPBlock refuses requests from the configured IPs, and from IPs that keep
// failing authentication (brute force) for a while. Mount it before the
// logger: the logger renders chain errors into the response, so the status
// read after c.Next() is the one the client gets.
//
// ponytail: state is per process and lost on restart; move it to a shared
// store (Postgres, Redis) when the API runs as more than one replica.
func IPBlock(cfg IPBlockConfig) (fiber.Handler, error) {
	blocked, err := parsePrefixes(cfg.Blocked)
	if err != nil {
		return nil, fmt.Errorf("ipblock: blocked: %w", err)
	}
	exempt, err := parsePrefixes(cfg.Exempt)
	if err != nil {
		return nil, fmt.Errorf("ipblock: exempt: %w", err)
	}
	if cfg.MaxFailures > 0 && (cfg.Duration <= 0 || cfg.IsFailure == nil) {
		return nil, fmt.Errorf("ipblock: auto-blocking needs a positive duration and IsFailure")
	}

	var mu sync.Mutex
	failures := map[netip.Addr]*ipFailures{}

	isBanned := func(ip netip.Addr, now time.Time) bool {
		mu.Lock()
		defer mu.Unlock()
		f := failures[ip]
		return f != nil && now.Before(f.blockedUntil)
	}

	recordFailure := func(ip netip.Addr, now time.Time) {
		mu.Lock()
		defer mu.Unlock()
		// ponytail: sweeps on growth only; enough unless millions of IPs fail.
		if len(failures) >= 10_000 {
			for k, f := range failures {
				if now.After(f.windowEnd) && now.After(f.blockedUntil) {
					delete(failures, k)
				}
			}
		}
		f := failures[ip]
		if f == nil || now.After(f.windowEnd) {
			f = &ipFailures{windowEnd: now.Add(cfg.Duration)}
			failures[ip] = f
		}
		f.count++
		if f.count >= cfg.MaxFailures {
			f.blockedUntil = now.Add(cfg.Duration)
			f.count, f.windowEnd = 0, f.blockedUntil
			if cfg.Logger != nil {
				cfg.Logger.Warn("ip auto-blocked after repeated failed attempts",
					"ip", ip.String(), "failures", cfg.MaxFailures, "until", f.blockedUntil)
			}
		}
	}

	return func(c fiber.Ctx) error {
		ip, err := netip.ParseAddr(c.IP())
		if err != nil {
			return c.Next()
		}
		ip = ip.Unmap()
		now := time.Now()

		if containsAddr(blocked, ip) || isBanned(ip, now) {
			return cfg.Denied(c)
		}

		if err := c.Next(); err != nil {
			return err
		}

		if cfg.MaxFailures > 0 && cfg.IsFailure(c) && !containsAddr(exempt, ip) {
			recordFailure(ip, now)
		}
		return nil
	}, nil
}

// parsePrefixes parses IPs and CIDRs; a bare IP becomes a single-address prefix.
func parsePrefixes(values []string) ([]netip.Prefix, error) {
	prefixes := make([]netip.Prefix, 0, len(values))
	for _, v := range values {
		if v = strings.TrimSpace(v); v == "" {
			continue
		}
		if strings.Contains(v, "/") {
			p, err := netip.ParsePrefix(v)
			if err != nil {
				return nil, err
			}
			prefixes = append(prefixes, p.Masked())
			continue
		}
		ip, err := netip.ParseAddr(v)
		if err != nil {
			return nil, err
		}
		ip = ip.Unmap()
		prefixes = append(prefixes, netip.PrefixFrom(ip, ip.BitLen()))
	}
	return prefixes, nil
}

func containsAddr(prefixes []netip.Prefix, ip netip.Addr) bool {
	for _, p := range prefixes {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}
