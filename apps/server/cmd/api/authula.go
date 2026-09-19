package main

import (
	"database/sql"
	"strings"
	"time"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/config"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/middlewares"
	appmodels "cloudrive/server/internal/models"
	"cloudrive/server/internal/services"

	authula "github.com/Authula/authula"
	authulaconfig "github.com/Authula/authula/config"
	"github.com/Authula/authula/events"
	authulamodels "github.com/Authula/authula/models"
	emailplugin "github.com/Authula/authula/plugins/email"
	emailpasswordplugin "github.com/Authula/authula/plugins/email-password"
	emailpasswordplugintypes "github.com/Authula/authula/plugins/email-password/types"
	emailplugintypes "github.com/Authula/authula/plugins/email/types"
	magiclinkplugin "github.com/Authula/authula/plugins/magic-link"
	magiclinkplugintypes "github.com/Authula/authula/plugins/magic-link/types"
	oauth2plugin "github.com/Authula/authula/plugins/oauth2"
	oauth2plugintypes "github.com/Authula/authula/plugins/oauth2/types"
	sessionplugin "github.com/Authula/authula/plugins/session"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

// authBasePath is the prefix under which Authula serves every auth endpoint
// (sign-up, sign-in, magic link, OAuth2, /me, sign-out, ...).
const authBasePath = "/v1/auth"

// authulaSchema keeps Authula's tables (its own users, sessions, accounts,
// verifications) out of the application's public schema, whose users/sessions
// tables have a different shape.
const authulaSchema = "authula"

// newAuthulaDB opens a dedicated Postgres connection for Authula that resolves
// unqualified table names inside the authula schema. The schema is created
// ahead of Authula's migrations, which would otherwise hit the application's
// existing users/sessions tables via CREATE TABLE IF NOT EXISTS and silently
// no-op.
func newAuthulaDB(cfg config.Config) (*bun.DB, error) {
	admin, err := sql.Open("postgres", cfg.DB.DSN)
	if err != nil {
		return nil, err
	}
	defer admin.Close()

	if _, err := admin.Exec("CREATE SCHEMA IF NOT EXISTS " + authulaSchema); err != nil {
		return nil, err
	}

	dsn := cfg.DB.DSN
	if strings.Contains(dsn, "?") {
		dsn += "&search_path=" + authulaSchema
	} else {
		dsn += "?search_path=" + authulaSchema
	}

	sqldb, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	sqldb.SetMaxOpenConns(cfg.DB.MaxOpenConns)
	sqldb.SetMaxIdleConns(cfg.DB.MaxIdleConns)
	sqldb.SetConnMaxIdleTime(cfg.DB.MaxIdleTime)

	return bun.NewDB(sqldb, pgdialect.New()), nil
}

// newAuthula wires the Authula instance: plugins (session, email via Resend,
// email & password, magic link, OAuth2 Google), route mappings, and the
// service hooks that bridge Authula users into the application's users table.
func newAuthula(application *app.Application, authulaDB *bun.DB) *authula.Auth {
	cfg := application.Config

	hooks := &authulamodels.CoreServiceHooksConfig{
		Users: &authulamodels.ServiceHooks[authulamodels.User]{},
	}
	hooks.Users.RegisterAfterCreate(syncUserToApp(application))
	hooks.Users.RegisterAfterUpdate(syncUserToApp(application))

	loggerLevel := "info"
	if cfg.App.Debug {
		loggerLevel = "debug"
	}

	config := authulaconfig.NewConfig(
		authulaconfig.WithAppName(cfg.App.Name),
		authulaconfig.WithBaseURL(cfg.App.ServerURL),
		authulaconfig.WithBasePath(authBasePath),
		authulaconfig.WithSecret(cfg.App.Secret),
		authulaconfig.WithDatabase(authulamodels.DatabaseConfig{
			Provider: "postgres",
		}),
		authulaconfig.WithLogger(authulamodels.LoggerConfig{
			Level: loggerLevel,
		}),
		authulaconfig.WithSession(authulamodels.SessionConfig{
			CookieName:         middlewares.SessionCookieName,
			ExpiresIn:          7 * 24 * time.Hour,
			UpdateAge:          24 * time.Hour,
			CookieMaxAge:       7 * 24 * time.Hour,
			Secure:             cfg.App.Env == "production",
			HttpOnly:           true,
			SameSite:           "lax",
			AutoCleanup:        true,
			CleanupInterval:    time.Hour,
			MaxSessionsPerUser: 5,
		}),
		authulaconfig.WithEventBus(authulamodels.EventBusConfig{
			Provider:              events.ProviderGoChannel,
			MaxConcurrentHandlers: 100,
			ContextTimeout:        5 * time.Second,
		}),
		authulaconfig.WithSecurity(authulamodels.SecurityConfig{
			TrustedOrigins: []string{cfg.App.CORSAllowedOrigins},
			TrustedProxies: cfg.App.TrustedProxies,
			CORS: authulamodels.CORSConfig{
				AllowCredentials: true,
				AllowedOrigins:   []string{cfg.App.CORSAllowedOrigins},
				AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
				AllowedHeaders:   []string{"Origin", "Content-Type", "Accept", "Authorization", "Set-Cookie", "Cookie"},
				MaxAge:           time.Hour,
			},
		}),
		authulaconfig.WithRouteMappings(routeMappings()),
		authulaconfig.WithCoreServiceHooks(hooks),
	)

	plugins := []authulamodels.Plugin{
		sessionplugin.New(sessionplugin.SessionPluginConfig{Enabled: true}),
		emailplugin.New(emailplugintypes.EmailPluginConfig{
			Enabled:     true,
			Provider:    emailplugintypes.ProviderResend,
			FromAddress: cfg.Resend.FromEmail,
			Resend:      &emailplugintypes.ResendConfig{ApiKey: cfg.Resend.ApiKey},
		}),
		emailpasswordplugin.New(emailpasswordplugintypes.EmailPasswordPluginConfig{
			Enabled:                  true,
			MinPasswordLength:        8,
			MaxPasswordLength:        128,
			RequireEmailVerification: true,
			AutoSignIn:               true,
			SendEmailOnSignUp:        true,
			SendEmailVerification:    sendVerificationEmail(application),
			SendPasswordResetEmail:   sendPasswordResetEmail(application),
		}),
		magiclinkplugin.New(magiclinkplugintypes.MagicLinkPluginConfig{
			Enabled:                        true,
			ExpiresIn:                      15 * time.Minute,
			SendMagicLinkVerificationEmail: sendMagicLinkEmail(application),
		}),
	}

	// Google OAuth is opt-in: Authula aborts startup when a provider is
	// registered with missing credentials, so only enable it once both the
	// client id and secret are configured.
	if cfg.Google.ClientID != "" && cfg.Google.ClientSecret != "" {
		plugins = append(plugins, oauth2plugin.New(oauth2plugintypes.OAuth2PluginConfig{
			Enabled: true,
			Providers: map[string]oauth2plugintypes.ProviderConfig{
				"google": {
					Enabled:      true,
					ClientID:     cfg.Google.ClientID,
					ClientSecret: cfg.Google.ClientSecret,
					RedirectURL:  cfg.App.ServerURL + authBasePath + "/oauth2/callback/google",
					Scopes:       []string{"openid", "email", "profile"},
				},
			},
		}))
	} else {
		application.Logger.Warn("google oauth2 disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it")
	}

	return authula.New(&authula.AuthConfig{
		Config:  config,
		Plugins: plugins,
		DB:      authulaDB,
	})
}

// routeMappings protects Authula's own routes. Auth endpoints that establish
// identity run anonymously (session.auth.optional); everything that touches
// an existing account requires a valid session (session.auth).
func routeMappings() []authulamodels.RouteMapping {
	return []authulamodels.RouteMapping{
		{
			Paths:   []string{"GET:/me", "POST:/sign-out"},
			Plugins: []string{"session.auth"},
		},
		{
			Paths: []string{
				"POST:/email-password/sign-up",
				"POST:/email-password/sign-in",
				"GET:/email-password/verify-email",
				"POST:/magic-link/sign-in",
				"GET:/magic-link/verify",
				"POST:/magic-link/exchange",
				"GET:/oauth2/authorize/google",
				"GET:/oauth2/callback/google",
			},
			Plugins: []string{"session.auth.optional"},
		},
		{
			Paths: []string{
				"POST:/email-password/send-email-verification",
				"POST:/email-password/request-password-reset",
				"POST:/email-password/change-password",
				"POST:/email-password/request-email-change",
			},
			Plugins: []string{"session.auth"},
		},
	}
}

type emailTemplateData struct {
	Fullname string
	Link     string
	AppName  string
}

// sendVerificationEmail routes Authula's verification mail through the
// application's Resend account and template. A mail failure is logged, not
// returned: the account is already created at this point and the user can
// request the email again.
func sendVerificationEmail(application *app.Application) func(emailpasswordplugintypes.SendEmailVerificationParams, *authulamodels.RequestContext) error {
	return func(params emailpasswordplugintypes.SendEmailVerificationParams, _ *authulamodels.RequestContext) error {
		if _, err := application.Services.Email.SendEmail(services.SendEmailParams{
			Subject:      "Verify your email address",
			To:           params.User.Email,
			Data:         emailTemplateData{Fullname: params.User.Name, Link: params.URL, AppName: application.Config.App.Name},
			HtmlTemplate: "templates/emails/registration.html",
		}); err != nil {
			application.Logger.Error("failed to send verification email", "error", err, "email", params.User.Email)
		}
		return nil
	}
}

func sendPasswordResetEmail(application *app.Application) func(emailpasswordplugintypes.SendPasswordResetEmailParams, *authulamodels.RequestContext) error {
	return func(params emailpasswordplugintypes.SendPasswordResetEmailParams, _ *authulamodels.RequestContext) error {
		if _, err := application.Services.Email.SendEmail(services.SendEmailParams{
			Subject:      "Reset your password",
			To:           params.User.Email,
			Data:         emailTemplateData{Fullname: params.User.Name, Link: params.URL, AppName: application.Config.App.Name},
			HtmlTemplate: "templates/emails/password-reset.html",
		}); err != nil {
			application.Logger.Error("failed to send password reset email", "error", err, "email", params.User.Email)
		}
		return nil
	}
}

func sendMagicLinkEmail(application *app.Application) func(magiclinkplugintypes.SendMagicLinkVerificationEmailParams, *authulamodels.RequestContext) error {
	return func(params magiclinkplugintypes.SendMagicLinkVerificationEmailParams, _ *authulamodels.RequestContext) error {
		if _, err := application.Services.Email.SendEmail(services.SendEmailParams{
			Subject:      "Your sign-in link",
			To:           params.Email,
			Data:         emailTemplateData{Fullname: "there", Link: params.URL, AppName: application.Config.App.Name},
			HtmlTemplate: "templates/emails/magic-link.html",
		}); err != nil {
			application.Logger.Error("failed to send magic link email", "error", err, "email", params.Email)
		}
		return nil
	}
}

// syncUserToApp mirrors an Authula user into the application's users table.
// The upsert makes it idempotent and self-heals rows that predate the hook.
// A failure is logged, not returned: the account already exists in Authula,
// and aborting the auth flow over a mirror write would break sign-up.
func syncUserToApp(application *app.Application) authulamodels.ServiceHook[authulamodels.User] {
	return func(user *authulamodels.User) error {
		first, last := splitName(user.Name)

		if err := application.Repositories.User.Upsert(&appmodels.User{
			ID:        uuid.MustParse(user.ID),
			Email:     user.Email,
			FirstName: first,
			LastName:  last,
			Image:     user.Image,
		}); err != nil {
			application.Logger.Error("failed to sync authula user into application users table", "error", err, "user_id", user.ID)
		}

		return nil
	}
}

// splitName splits Authula's single display name into the application's
// first/last name columns.
func splitName(name string) (string, *string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "User", nil
	}

	first, last, found := strings.Cut(name, " ")
	if !found || strings.TrimSpace(last) == "" {
		return first, nil
	}

	return first, lib.StringPtr(strings.TrimSpace(last))
}
