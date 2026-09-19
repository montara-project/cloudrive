package config

import "time"

type Config struct {
	App    ConfigApp
	DB     ConfigDB
	Resend ConfigResend
	Google ConfigGoogle
	S3     ConfigS3
}

type ConfigApp struct {
	Env            string
	Debug          bool
	Port           int
	MachineID      uint16
	Name           string
	Secret         string
	ClientURL      string
	ServerURL      string
	TrustedProxies []string
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
