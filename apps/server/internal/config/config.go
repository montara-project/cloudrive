package config

import "time"

type Config struct {
	App     ConfigApp
	DB      ConfigDB
	Resend  ConfigResend
	Google  ConfigGoogle
	S3      ConfigS3
	Storage ConfigStorage
	Diag    ConfigDiag
}

type ConfigApp struct {
	Env                string
	Debug              bool
	Port               int
	MachineID          uint16
	Name               string
	Secret             string
	ClientURL          string
	ServerURL          string
	CORSAllowedOrigins string
	TrustedProxies     []string
	SuperUser          ConfigSuperUser
}

// ConfigSuperUser is the default admin account seeded at startup, parsed
// from the SUPER_USER flag in email:password form. Empty means no seeding.
type ConfigSuperUser struct {
	Email    string
	Password string
}

type ConfigDB struct {
	DSN          string
	MaxOpenConns int
	MaxIdleConns int
	MaxIdleTime  time.Duration
}

type ConfigResend struct {
	ApiKey       string
	FromEmail    string
	DebugToEmail string
}

type ConfigGoogle struct {
	ClientID     string
	ClientSecret string
}

type ConfigS3 struct {
	ClientID     string
	ClientSecret string
	Region       string
	Endpoint     string
	Token        string
}

// ConfigStorage holds the key spec for the provider credential vault: comma
// separated "key_id:base64(32-byte key)" entries, the first of which encrypts
// new secrets while the rest remain available for decryption during rotation.
type ConfigStorage struct {
	CredentialsKeys string
}

// ConfigDiag controls boot failure diagnosis (TypeSafe Jev) and first-boot
// recovery in containers.
type ConfigDiag struct {
	// TypesafeAPIKey enables the Jev boot diagnosis; empty disables it and
	// the app degrades to deterministic remediation hints.
	TypesafeAPIKey string
	// TypesafeAPIURL overrides the TypeSafe endpoint (self-host / tests).
	TypesafeAPIURL string
	// MigrateOnBoot lets the server apply SQL migrations (via the migrate
	// binary) when boot fails on missing application tables.
	MigrateOnBoot bool
}
