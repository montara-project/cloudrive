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

	r.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Hello, World!",
		})
	})

	r.Get("/health", h.Health.Check)

	// Authula serves every auth endpoint under /v1/auth (email & password,
	// magic link, OAuth2, /me, sign-out) with its own route mappings. The
	// adapter forwards the request path verbatim and Authula registers its
	// routes with the base path prepended, so the mount prefix must equal
	// authBasePath exactly.
	r.Use(authBasePath, fiberadapter.New(fiberadapter.Config{
		Handler: app.Auth.Handler(),
	}))

	// Application routes that require a bearer token.
	r.Get("/v1/me", m.Authorization(), h.User.Me)

	// Providers (catalog).
	r.Get("/v1/providers", m.Authorization(), h.Provider.List)

	// Organizations.
	r.Post("/v1/organizations", m.Authorization(), h.Organization.Create)
	r.Get("/v1/organizations", m.Authorization(), h.Organization.List)
	r.Get("/v1/organizations/:orgId", m.Authorization(), h.Organization.Get)
	r.Patch("/v1/organizations/:orgId", m.Authorization(), h.Organization.Update)
	r.Delete("/v1/organizations/:orgId", m.Authorization(), h.Organization.Delete)

	// Organization members.
	r.Get("/v1/organizations/:orgId/members", m.Authorization(), h.OrganizationMember.List)
	r.Post("/v1/organizations/:orgId/members", m.Authorization(), h.OrganizationMember.Add)
	r.Patch("/v1/organizations/:orgId/members/:userId", m.Authorization(), h.OrganizationMember.UpdateRole)
	r.Delete("/v1/organizations/:orgId/members/:userId", m.Authorization(), h.OrganizationMember.Remove)

	// Organization invitations.
	r.Post("/v1/organizations/:orgId/invitations", m.Authorization(), h.OrganizationInvitation.Create)
	r.Get("/v1/organizations/:orgId/invitations", m.Authorization(), h.OrganizationInvitation.List)
	r.Patch("/v1/organizations/:orgId/invitations/:invitationId", m.Authorization(), h.OrganizationInvitation.UpdateStatus)
	r.Delete("/v1/organizations/:orgId/invitations/:invitationId", m.Authorization(), h.OrganizationInvitation.Delete)

	// Workspaces (nested under the organization for creation/listing).
	r.Post("/v1/organizations/:orgId/workspaces", m.Authorization(), h.Workspace.Create)
	r.Get("/v1/organizations/:orgId/workspaces", m.Authorization(), h.Workspace.List)
	r.Get("/v1/workspaces/:wsId", m.Authorization(), h.Workspace.Get)
	r.Patch("/v1/workspaces/:wsId", m.Authorization(), h.Workspace.Update)
	r.Delete("/v1/workspaces/:wsId", m.Authorization(), h.Workspace.Delete)

	// Workspace members.
	r.Get("/v1/workspaces/:wsId/members", m.Authorization(), h.WorkspaceMember.List)
	r.Post("/v1/workspaces/:wsId/members", m.Authorization(), h.WorkspaceMember.Add)
	r.Patch("/v1/workspaces/:wsId/members/:userId", m.Authorization(), h.WorkspaceMember.UpdateRole)
	r.Delete("/v1/workspaces/:wsId/members/:userId", m.Authorization(), h.WorkspaceMember.Remove)

	// Storage accounts (connected provider accounts).
	r.Post("/v1/storage/accounts", m.Authorization(), h.StorageAccount.Connect)
	r.Get("/v1/storage/accounts", m.Authorization(), h.StorageAccount.List)
	r.Get("/v1/storage/accounts/:accountId", m.Authorization(), h.StorageAccount.Get)
	r.Patch("/v1/storage/accounts/:accountId", m.Authorization(), h.StorageAccount.Update)
	r.Put("/v1/storage/accounts/:accountId/credentials", m.Authorization(), h.StorageAccount.Rotate)
	r.Delete("/v1/storage/accounts/:accountId", m.Authorization(), h.StorageAccount.Disconnect)

	// Storage provider OAuth connect flow. The callback is invoked by the
	// provider (no bearer token); it is protected by the signed state
	// parameter instead. Refresh/Quota require a bearer token.
	r.Post("/v1/storage/oauth/:provider_slug/authorize", m.Authorization(), h.StorageAccountOAuth.Authorize)
	r.Get("/v1/storage/oauth/:provider_slug/callback", h.StorageAccountOAuth.Callback)
	r.Post("/v1/storage/accounts/:accountId/refresh", m.Authorization(), h.StorageAccountOAuth.Refresh)
	r.Get("/v1/storage/accounts/:accountId/quota", m.Authorization(), h.StorageAccountOAuth.Quota)

	// S3-compatible gateway management (SigV4 access keys and bucket
	// mappings). Creation/revocation requires org owner or admin.
	r.Post("/v1/workspaces/:wsId/s3/credentials", m.Authorization(), h.S3Gateway.CreateCredential)
	r.Get("/v1/workspaces/:wsId/s3/credentials", m.Authorization(), h.S3Gateway.ListCredentials)
	r.Delete("/v1/workspaces/:wsId/s3/credentials/:credentialId", m.Authorization(), h.S3Gateway.RevokeCredential)
	r.Post("/v1/workspaces/:wsId/s3/buckets", m.Authorization(), h.S3Gateway.CreateBucket)
	r.Get("/v1/workspaces/:wsId/s3/buckets", m.Authorization(), h.S3Gateway.ListBuckets)
	r.Delete("/v1/workspaces/:wsId/s3/buckets/:bucketId", m.Authorization(), h.S3Gateway.DeleteBucket)
}
