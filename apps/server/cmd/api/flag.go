package main

import (
	"flag"
	"log"
	"strings"
	"time"

	"cloudrive/server/internal/config"
)

func parseFlag(cfg *config.Config) {
	var machineID uint
	var trustedProxies string
	var superUser string

	// App
	flag.UintVar(&machineID, "machine-id", 0, "Machine ID")
	flag.StringVar(&cfg.App.Env, "env", "development", "Environment")
	flag.BoolVar(&cfg.App.Debug, "debug", false, "Debug mode")
	flag.IntVar(&cfg.App.Port, "port", 8080, "Port")
	flag.StringVar(&cfg.App.Name, "app-name", "gofi", "App Name")
	flag.StringVar(&cfg.App.Secret, "app-secret", "", "App Secret (also used by Authula)")
	flag.StringVar(&cfg.App.CORSAllowedOrigins, "cors-allowed-origins", "*", "CORS Allowed Origins")
	flag.StringVar(&cfg.App.ClientURL, "client-url", "", "Client URL")
	flag.StringVar(&cfg.App.ServerURL, "server-url", "", "Server URL")
	// comma-separated CIDRs/IPs of reverse proxies whose X-Forwarded-For may be
	// trusted. Leave empty when the app is exposed directly.
	flag.StringVar(&trustedProxies, "trusted-proxies", "", "Trusted proxy IPs/CIDRs (comma-separated)")

	// Default admin account seeded at startup, in email:password form.
	flag.StringVar(&superUser, "super-user", "", "Default admin user (email:password, optional)")

	// Database
	flag.StringVar(&cfg.DB.DSN, "db-dsn", "", "Database DSN")
	flag.IntVar(&cfg.DB.MaxOpenConns, "db-max-open-conns", 25, "Database max open connections")
	flag.IntVar(&cfg.DB.MaxIdleConns, "db-max-idle-conns", 25, "Database max idle connections")
	flag.DurationVar(&cfg.DB.MaxIdleTime, "db-max-idle-time", 15*time.Minute, "Database max idle time")

	// Resend
	flag.StringVar(&cfg.Resend.ApiKey, "resend-api-key", "", "Resend API key")
	flag.StringVar(&cfg.Resend.FromEmail, "resend-from-email", "", "Resend from email")
	flag.StringVar(&cfg.Resend.DebugToEmail, "resend-debug-to-email", "", "Resend debug to email")

	// Google (used by Authula's OAuth2 plugin)
	flag.StringVar(&cfg.Google.ClientID, "google-client-id", "", "Google client ID")
	flag.StringVar(&cfg.Google.ClientSecret, "google-client-secret", "", "Google client secret")

	// S3
	flag.StringVar(&cfg.S3.ClientID, "s3-client-id", "", "S3 client ID")
	flag.StringVar(&cfg.S3.ClientSecret, "s3-client-secret", "", "S3 client secret")
	flag.StringVar(&cfg.S3.Region, "s3-region", "", "S3 region")
	flag.StringVar(&cfg.S3.Endpoint, "s3-endpoint", "", "S3 endpoint")
	flag.StringVar(&cfg.S3.Token, "s3-token", "", "S3 token")

	// Storage provider credential vault: comma-separated key_id:base64 entries
	// (32-byte keys); the first entry encrypts new secrets.
	flag.StringVar(&cfg.Storage.CredentialsKeys, "storage-credentials-keys", "", "Provider credential encryption keys (key_id:base64(32-byte key), comma-separated)")

	// Boot diagnostics (TypeSafe Jev) and container first-run recovery.
	flag.StringVar(&cfg.Diag.TypesafeAPIKey, "typesafe-api-key", "", "TypeSafe API key enabling Jev boot failure diagnosis (optional)")
	flag.StringVar(&cfg.Diag.TypesafeAPIURL, "typesafe-api-url", "", "TypeSafe API base URL override (optional)")
	flag.BoolVar(&cfg.Diag.MigrateOnBoot, "migrate-on-boot", false, "Apply SQL migrations automatically when boot fails on missing application tables (container first-run)")

	flag.Parse()

	uint16Max := uint(1<<16 - 1)
	if machineID > uint16Max {
		log.Fatal("flag machine-id can only handle uint16")
		return
	}

	cfg.App.MachineID = uint16(machineID)

	if trustedProxies != "" {
		for _, proxy := range strings.Split(trustedProxies, ",") {
			if trimmed := strings.TrimSpace(proxy); trimmed != "" {
				cfg.App.TrustedProxies = append(cfg.App.TrustedProxies, trimmed)
			}
		}
	}

	// strings.Cut splits on the first colon only, so the password itself may
	// contain colons; the email may not.
	if superUser != "" {
		email, password, found := strings.Cut(superUser, ":")
		if !found || strings.TrimSpace(email) == "" || password == "" {
			log.Fatal("flag super-user must be in email:password format")
		}

		if len(password) < 8 {
			log.Fatal("flag super-user password must be at least 8 characters")
		}

		cfg.App.SuperUser = config.ConfigSuperUser{Email: email, Password: password}
	}

	validateFlag(cfg)
}

func validateFlag(cfg *config.Config) {
	if cfg.App.Env == "" {
		log.Println("flag environment is marked as local")
	}

	if cfg.App.MachineID == 0 {
		log.Fatal("flag machine-id must be provided and cannot be 0")
	}

	if cfg.App.Secret == "" {
		log.Fatal("flag app-secret must be provided")
	}

	if cfg.App.ClientURL == "" {
		log.Fatal("flag client-url must be provided")
	}

	if cfg.App.ServerURL == "" {
		log.Fatal("flag server-url must be provided")
	}

	if cfg.DB.DSN == "" {
		log.Fatal("flag db-dsn must be provided")
	}

	if cfg.Resend.ApiKey == "" {
		log.Fatal("flag resend-api-key must be provided")
	}

	if cfg.Resend.FromEmail == "" {
		log.Fatal("flag resend-from-email must be provided")
	}

	if cfg.Resend.DebugToEmail == "" {
		log.Fatal("flag resend-debug-to-email must be provided")
	}

	// Fail closed: without encryption keys the server must not start, or
	// provider credentials could end up stored in plaintext.
	if cfg.Storage.CredentialsKeys == "" {
		log.Fatal("flag storage-credentials-keys must be provided (see STORAGE_CREDENTIALS_KEYS in .env.example)")
	}
}
