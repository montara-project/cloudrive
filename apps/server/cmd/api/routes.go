package main

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/handlers"
	"cloudrive/server/internal/middlewares"

	fiberadapter "github.com/Authula/authula/adapters/fiber"
	"github.com/gofiber/fiber/v3"
)

func routes(r *fiber.App, app *app.Application) {
	h := handlers.New(app)
	m := middlewares.New(app)

	// Every API endpoint lives under /api; the SPA owns everything else
	// (see server.go).
	if app.Config.App.SPADir == "" {
		r.Get("/api", func(c fiber.Ctx) error {
			return c.JSON(fiber.Map{
				"message": "Hello, World!",
			})
		})
	}

	r.Get("/api/health", h.Health.Check)

	// Authula serves every auth endpoint under /api/v1/auth (email &
	// password, magic link, OAuth2, /me, sign-out) with its own route
	// mappings. The adapter forwards the request path verbatim and Authula
	// registers its routes with the base path prepended, so the mount prefix
	// must equal authBasePath exactly.
	r.Use(authBasePath, fiberadapter.New(fiberadapter.Config{
		Handler: app.Auth.Handler(),
	}))

	// Application routes that require a bearer token.
	v1 := r.Group("/api/v1")

	v1.Get("/me", m.Authorization, h.User.Me)

	// Onboarding survey (one per user, upsert).
	v1.Post("/onboarding/survey", m.Authorization, h.Onboarding.Submit)

	// Providers (catalog).
	v1.Get("/providers", m.Authorization, h.Provider.List)

	// Organizations.
	v1.Post("/organizations", m.Authorization, h.Organization.Create)
	v1.Get("/organizations", m.Authorization, h.Organization.List)
	v1.Get("/organizations/:orgId", m.Authorization, h.Organization.Get)
	v1.Patch("/organizations/:orgId", m.Authorization, h.Organization.Update)
	v1.Delete("/organizations/:orgId", m.Authorization, h.Organization.Delete)

	// Organization members.
	v1.Get("/organizations/:orgId/members", m.Authorization, h.OrganizationMember.List)
	v1.Post("/organizations/:orgId/members", m.Authorization, h.OrganizationMember.Add)
	v1.Patch("/organizations/:orgId/members/:userId", m.Authorization, h.OrganizationMember.UpdateRole)
	v1.Delete("/organizations/:orgId/members/:userId", m.Authorization, h.OrganizationMember.Remove)

	// Organization invitations.
	v1.Post("/organizations/:orgId/invitations", m.Authorization, h.OrganizationInvitation.Create)
	v1.Get("/organizations/:orgId/invitations", m.Authorization, h.OrganizationInvitation.List)
	v1.Patch("/organizations/:orgId/invitations/:invitationId", m.Authorization, h.OrganizationInvitation.UpdateStatus)
	v1.Delete("/organizations/:orgId/invitations/:invitationId", m.Authorization, h.OrganizationInvitation.Delete)

	// Workspaces (nested under the organization for creation/listing).
	v1.Post("/organizations/:orgId/workspaces", m.Authorization, h.Workspace.Create)
	v1.Get("/organizations/:orgId/workspaces", m.Authorization, h.Workspace.List)
	v1.Get("/workspaces/:wsId", m.Authorization, h.Workspace.Get)
	v1.Patch("/workspaces/:wsId", m.Authorization, h.Workspace.Update)
	v1.Delete("/workspaces/:wsId", m.Authorization, h.Workspace.Delete)

	// Workspace members.
	v1.Get("/workspaces/:wsId/members", m.Authorization, h.WorkspaceMember.List)
	v1.Post("/workspaces/:wsId/members", m.Authorization, h.WorkspaceMember.Add)
	v1.Patch("/workspaces/:wsId/members/:userId", m.Authorization, h.WorkspaceMember.UpdateRole)
	v1.Delete("/workspaces/:wsId/members/:userId", m.Authorization, h.WorkspaceMember.Remove)

	// Storage accounts (connected provider accounts).
	v1.Post("/storage/accounts", m.Authorization, h.StorageAccount.Connect)
	v1.Get("/storage/accounts", m.Authorization, h.StorageAccount.List)
	v1.Get("/storage/accounts/:accountId", m.Authorization, h.StorageAccount.Get)
	v1.Patch("/storage/accounts/:accountId", m.Authorization, h.StorageAccount.Update)
	v1.Put("/storage/accounts/:accountId/credentials", m.Authorization, h.StorageAccount.Rotate)
	v1.Delete("/storage/accounts/:accountId", m.Authorization, h.StorageAccount.Disconnect)

	// Storage provider OAuth connect flow. The callback is invoked by the
	// provider (no bearer token); it is protected by the signed state
	// parameter instead. Refresh/Quota require a bearer token.
	v1.Post("/storage/oauth/:provider_slug/authorize", m.Authorization, h.StorageAccountOAuth.Authorize)
	v1.Get("/storage/oauth/:provider_slug/callback", h.StorageAccountOAuth.Callback)
	v1.Post("/storage/accounts/:accountId/refresh", m.Authorization, h.StorageAccountOAuth.Refresh)
	v1.Get("/storage/accounts/:accountId/quota", m.Authorization, h.StorageAccountOAuth.Quota)

	// S3-compatible gateway management (SigV4 access keys and bucket
	// mappings). Creation/revocation requires org owner or admin.
	v1.Post("/workspaces/:wsId/s3/credentials", m.Authorization, h.S3Gateway.CreateCredential)
	v1.Get("/workspaces/:wsId/s3/credentials", m.Authorization, h.S3Gateway.ListCredentials)
	v1.Delete("/workspaces/:wsId/s3/credentials/:credentialId", m.Authorization, h.S3Gateway.RevokeCredential)
	v1.Post("/workspaces/:wsId/s3/buckets", m.Authorization, h.S3Gateway.CreateBucket)
	v1.Get("/workspaces/:wsId/s3/buckets", m.Authorization, h.S3Gateway.ListBuckets)
	v1.Delete("/workspaces/:wsId/s3/buckets/:bucketId", m.Authorization, h.S3Gateway.DeleteBucket)
	v1.Get("/workspaces/:wsId/s3/recent-files", m.Authorization, h.S3Gateway.RecentFiles)
	v1.Get("/workspaces/:wsId/drive", m.Authorization, h.S3Gateway.Drive)
}
