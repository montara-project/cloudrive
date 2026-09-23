package handlers

import "cloudrive/server/internal/app"

// Handlers mirrors the repositories: one handler per repository file. Each
// handler resolves its repositories through app.Repositories, so the factory
// only attaches the application.
type Handlers struct {
	Health                 healthHandler
	User                   userHandler
	Provider               providerHandler
	Organization           organizationHandler
	OrganizationMember     organizationMemberHandler
	OrganizationInvitation organizationInvitationHandler
	Workspace              workspaceHandler
	WorkspaceMember        workspaceMemberHandler
	StorageAccount         storageAccountHandler
	StorageAccountOAuth    storageAccountOAuthHandler
	S3Gateway              s3GatewayHandler
}

func New(app *app.Application) Handlers {
	return Handlers{
		Health:                 healthHandler{app: app},
		User:                   userHandler{app: app},
		Provider:               providerHandler{app: app},
		Organization:           organizationHandler{app: app},
		OrganizationMember:     organizationMemberHandler{app: app},
		OrganizationInvitation: organizationInvitationHandler{app: app},
		Workspace:              workspaceHandler{app: app},
		WorkspaceMember:        workspaceMemberHandler{app: app},
		StorageAccount:         storageAccountHandler{app: app},
		StorageAccountOAuth:    storageAccountOAuthHandler{app: app},
		S3Gateway:              s3GatewayHandler{app: app},
	}
}
