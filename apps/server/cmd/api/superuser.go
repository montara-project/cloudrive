package main

import (
	"context"
	"time"

	"cloudrive/server/internal/app"
	appmodels "cloudrive/server/internal/models"

	authulamodels "github.com/Authula/authula/models"
	"github.com/google/uuid"
)

// ensureSuperUser seeds the default admin account from the SUPER_USER flag
// (email:password). It runs once per boot and is idempotent:
//
//   - missing user  -> created with a verified email, role=admin metadata,
//     and a hashed password credential (no verification email, no session);
//   - existing user -> promoted to verified admin and its password credential
//     is reset to the configured password. The reset is deliberate: with open
//     sign-up anyone can register the email before the operator configures
//     SUPER_USER, and keeping the squatter's password would hand the promoted
//     admin identity to that attacker. Changing SUPER_USER_PASSWORD in .env
//     therefore also rotates the credential on the next boot.
//
// The application mirror row is upserted directly so the admin is usable by
// app handlers immediately, independent of Authula's service hooks.
// Returns nil when SUPER_USER is not configured.
func ensureSuperUser(application *app.Application) error {
	super := application.Config.App.SuperUser
	if super.Email == "" || super.Password == "" {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	core := application.Auth.CoreServices()
	providerID := authulamodels.AuthProviderEmail.String()

	user, err := core.UserService.GetByEmail(ctx, super.Email)
	if err != nil {
		return err
	}

	if user == nil {
		hash, err := core.PasswordService.Hash(super.Password)
		if err != nil {
			return err
		}

		user, err = core.UserService.Create(ctx, "Super User", super.Email, true, nil, map[string]any{"role": "admin"})
		if err != nil {
			return err
		}

		// Same account shape the email-password plugin creates on sign-up:
		// account id = email, provider = AuthProviderEmail, password pre-hashed.
		if _, err := core.AccountService.Create(ctx, user.ID, user.Email, providerID, &hash); err != nil {
			return err
		}

		application.Logger.Info("super user seeded", "email", super.Email)
	} else {
		changed := false

		if !user.EmailVerified {
			user.EmailVerified = true
			changed = true
		}

		if role, ok := user.Metadata["role"].(string); !ok || role != "admin" {
			if user.Metadata == nil {
				user.Metadata = map[string]any{}
			}
			user.Metadata["role"] = "admin"
			changed = true
		}

		if changed {
			if _, err := core.UserService.Update(ctx, user); err != nil {
				return err
			}
			application.Logger.Info("super user promoted to admin", "email", super.Email)
		}

		hash, err := core.PasswordService.Hash(super.Password)
		if err != nil {
			return err
		}

		account, err := core.AccountService.GetByUserIDAndProvider(ctx, user.ID, providerID)
		if err != nil {
			return err
		}

		if account == nil {
			if _, err := core.AccountService.Create(ctx, user.ID, user.Email, providerID, &hash); err != nil {
				return err
			}

			application.Logger.Info("super user password credential created", "email", super.Email)
		} else {
			// Reset, never keep: see the docblock — the existing credential
			// may belong to whoever squatted the email through open sign-up.
			account.Password = &hash
			if _, err := core.AccountService.Update(ctx, account); err != nil {
				return err
			}

			application.Logger.Info("super user password credential reset to configured value", "email", super.Email)
		}
	}

	first, last := splitName(user.Name)
	if err := application.Repositories.User.Upsert(ctx, appmodels.User{
		ID:        uuid.MustParse(user.ID),
		Email:     user.Email,
		FirstName: first,
		LastName:  last,
		Image:     user.Image,
		Role:      "admin",
	}); err != nil {
		return err
	}

	// Upsert only sets role on insert; the promote path must overwrite an
	// existing row's role explicitly.
	if err := application.Repositories.User.SetRole(ctx, uuid.MustParse(user.ID), "admin"); err != nil {
		return err
	}

	return nil
}
