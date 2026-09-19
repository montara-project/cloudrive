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
//   - existing user -> only promoted to verified admin when needed, and a
//     password credential is added if the user has none (e.g. it was created
//     through Google OAuth before SUPER_USER was configured). The password is
//     never reset, so a changed password survives restarts.
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

		account, err := core.AccountService.GetByUserIDAndProvider(ctx, user.ID, providerID)
		if err != nil {
			return err
		}

		if account == nil {
			hash, err := core.PasswordService.Hash(super.Password)
			if err != nil {
				return err
			}

			if _, err := core.AccountService.Create(ctx, user.ID, user.Email, providerID, &hash); err != nil {
				return err
			}

			application.Logger.Info("super user password credential created", "email", super.Email)
		}
	}

	first, last := splitName(user.Name)
	if err := application.Repositories.User.Upsert(&appmodels.User{
		ID:        uuid.MustParse(user.ID),
		Email:     user.Email,
		FirstName: first,
		LastName:  last,
		Image:     user.Image,
		Role:      roleFromMetadata(user.Metadata),
	}); err != nil {
		return err
	}

	return nil
}
