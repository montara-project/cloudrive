package main

import (
	"flag"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"cloudrive/server/internal/config"
)

// Every flag defaults to its environment variable, so `make run` (which exports
// .env) and the container (which sets env) need no argument list; an explicit
// flag still wins over the environment.

func envString(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		log.Fatalf("env %s: %q is not a boolean", key, v)
	}
	return b
}

func envInt(key string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		log.Fatalf("env %s: %q is not an integer", key, v)
	}
	return n
}

func envUint(key string, fallback uint) uint {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	n, err := strconv.ParseUint(v, 10, 0)
	if err != nil {
		log.Fatalf("env %s: %q is not an unsigned integer", key, v)
	}
	return uint(n)
}

func envDuration(key string, fallback time.Duration) time.Duration {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Fatalf("env %s: %q is not a duration", key, v)
	}
	return d
}

func parseFlag(cfg *config.Config) {
	var machineID uint
	var trustedProxies string
	var blockedIPs string
	var superUser string

	// App
	flag.UintVar(&machineID, "machine-id", envUint("MACHINE_ID", 0), "Machine ID")
	flag.StringVar(&cfg.App.Env, "env", envString("ENV", config.EnvProduction), "Environment: development, staging or production")
	flag.BoolVar(&cfg.App.Debug, "debug", envBool("DEBUG", false), "Debug mode")
	flag.IntVar(&cfg.App.Port, "port", envInt("PORT", 8080), "Port")
	flag.StringVar(&cfg.App.Name, "app-name", envString("APP_NAME", "gofi"), "App Name")
	flag.StringVar(&cfg.App.Secret, "app-secret", envString("APP_SECRET", ""), "App Secret (also used by Authula)")
	flag.StringVar(&cfg.App.CORSAllowedOrigins, "cors-allowed-origins", envString("CORS_ALLOWED_ORIGINS", "*"), "CORS Allowed Origins")
	flag.StringVar(&cfg.App.ClientURL, "client-url", envString("CLIENT_URL", ""), "Client URL")
	flag.StringVar(&cfg.App.ServerURL, "server-url", envString("SERVER_URL", ""), "Server URL")
	// comma-separated CIDRs/IPs of reverse proxies whose X-Forwarded-For may be
	// trusted. Leave empty when the app is exposed directly.
	flag.StringVar(&trustedProxies, "trusted-proxies", envString("TRUSTED_PROXIES", ""), "Trusted proxy IPs/CIDRs (comma-separated)")

	// IP blocking: a static deny list, plus auto-blocking of IPs that keep
	// failing authentication (brute force).
	flag.StringVar(&blockedIPs, "blocked-ips", envString("BLOCKED_IPS", ""), "Blocked client IPs/CIDRs (comma-separated)")
	flag.IntVar(&cfg.App.IPBlockMaxFailures, "ip-block-max-failures", envInt("IP_BLOCK_MAX_FAILURES", 10), "Failed auth attempts within ip-block-duration that block an IP; 0 disables auto-blocking")
	flag.DurationVar(&cfg.App.IPBlockDuration, "ip-block-duration", envDuration("IP_BLOCK_DURATION", 15*time.Minute), "Failure counting window and auto-block length")

	// Built single-page app (apps/web) served at /; empty disables it.
	flag.StringVar(&cfg.App.SPADir, "spa-dir", envString("SPA_DIR", ""), "Directory of a built single-page app served at / (empty disables)")

	// Default admin account seeded at startup, in email:password form.
	flag.StringVar(&superUser, "super-user", envString("SUPER_USER", ""), "Default admin user (email:password, optional)")

	// Database
	flag.StringVar(&cfg.DB.DSN, "db-dsn", envString("DB_DSN", ""), "Database DSN")
	flag.IntVar(&cfg.DB.MaxOpenConns, "db-max-open-conns", envInt("DB_MAX_OPEN_CONNS", 25), "Database max open connections")
	flag.IntVar(&cfg.DB.MaxIdleConns, "db-max-idle-conns", envInt("DB_MAX_IDLE_CONNS", 25), "Database max idle connections")
	flag.DurationVar(&cfg.DB.MaxIdleTime, "db-max-idle-time", envDuration("DB_MAX_IDLE_TIME", 15*time.Minute), "Database max idle time")

	// Resend
	flag.StringVar(&cfg.Resend.ApiKey, "resend-api-key", envString("RESEND_API_KEY", ""), "Resend API key")
	flag.StringVar(&cfg.Resend.FromEmail, "resend-from-email", envString("RESEND_FROM_EMAIL", ""), "Resend from email")
	flag.StringVar(&cfg.Resend.DebugToEmail, "resend-debug-to-email", envString("RESEND_DEBUG_TO_EMAIL", ""), "Resend debug to email")

	// Google (used by Authula's OAuth2 plugin and the Google Drive connector)
	flag.StringVar(&cfg.Google.ClientID, "google-client-id", envString("GOOGLE_CLIENT_ID", ""), "Google client ID")
	flag.StringVar(&cfg.Google.ClientSecret, "google-client-secret", envString("GOOGLE_CLIENT_SECRET", ""), "Google client secret")

	// OneDrive (Microsoft Graph OAuth2, storage provider connector)
	flag.StringVar(&cfg.OneDrive.ClientID, "onedrive-client-id", envString("ONEDRIVE_CLIENT_ID", ""), "OneDrive client ID")
	flag.StringVar(&cfg.OneDrive.ClientSecret, "onedrive-client-secret", envString("ONEDRIVE_CLIENT_SECRET", ""), "OneDrive client secret")
	flag.StringVar(&cfg.OneDrive.Tenant, "onedrive-tenant", envString("ONEDRIVE_TENANT_ID", "common"), "OneDrive authority tenant (common|consumers|organizations|directory id)")

	// Dropbox (OAuth2, storage provider connector)
	flag.StringVar(&cfg.Dropbox.ClientID, "dropbox-client-id", envString("DROPBOX_CLIENT_ID", ""), "Dropbox client ID")
	flag.StringVar(&cfg.Dropbox.ClientSecret, "dropbox-client-secret", envString("DROPBOX_CLIENT_SECRET", ""), "Dropbox client secret")

	// S3
	flag.StringVar(&cfg.S3.ClientID, "s3-client-id", envString("S3_CLIENT_ID", ""), "S3 client ID")
	flag.StringVar(&cfg.S3.ClientSecret, "s3-client-secret", envString("S3_CLIENT_SECRET", ""), "S3 client secret")
	flag.StringVar(&cfg.S3.Region, "s3-region", envString("S3_REGION", ""), "S3 region")
	flag.StringVar(&cfg.S3.Endpoint, "s3-endpoint", envString("S3_ENDPOINT", ""), "S3 endpoint")
	flag.StringVar(&cfg.S3.Token, "s3-token", envString("S3_TOKEN", ""), "S3 token")

	// S3-compatible gateway: separate listener speaking the S3 REST dialect
	// (SigV4, path-style, XML). 0 disables the gateway listener.
	flag.IntVar(&cfg.S3.APIPort, "s3-api-port", envInt("S3_API_PORT", 9000), "S3 gateway listen port; 0 disables it")
	flag.StringVar(&cfg.S3.StagingDir, "s3-staging-dir", envString("S3_STAGING_DIR", ""), "Staging directory for multipart uploads to non-passthrough backends")

	// Storage provider credential vault: comma-separated key_id:base64 entries
	// (32-byte keys); the first entry encrypts new secrets.
	flag.StringVar(&cfg.Storage.CredentialsKeys, "storage-credentials-keys", envString("STORAGE_CREDENTIALS_KEYS", ""), "Provider credential encryption keys (key_id:base64(32-byte key), comma-separated)")

	// Boot diagnostics (TypeSafe Jev) and container first-run recovery.
	flag.StringVar(&cfg.Diag.TypesafeAPIKey, "typesafe-api-key", envString("TYPESAFE_API_KEY", ""), "TypeSafe API key enabling Jev boot failure diagnosis (optional)")
	flag.StringVar(&cfg.Diag.TypesafeAPIURL, "typesafe-api-url", envString("TYPESAFE_API_URL", ""), "TypeSafe API base URL override (optional)")
	flag.BoolVar(&cfg.Diag.MigrateOnBoot, "migrate-on-boot", envBool("MIGRATE_ON_BOOT", false), "Apply SQL migrations automatically when boot fails on missing application tables (container first-run)")

	flag.Parse()

	uint16Max := uint(1<<16 - 1)
	if machineID > uint16Max {
		log.Fatal("flag machine-id can only handle uint16")
		return
	}

	cfg.App.MachineID = uint16(machineID)

	cfg.App.TrustedProxies = splitList(trustedProxies)
	cfg.App.BlockedIPs = splitList(blockedIPs)

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

	// Fail closed: without encryption keys the server must not start, or
	// provider credentials could end up stored in plaintext.
	if cfg.Storage.CredentialsKeys == "" {
		log.Fatal("flag storage-credentials-keys must be provided (see STORAGE_CREDENTIALS_KEYS in .env.example)")
	}
}

// splitList splits a comma-separated flag value, dropping empty entries.
func splitList(value string) []string {
	var items []string
	for _, item := range strings.Split(value, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}
