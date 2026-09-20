package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type storageAccountHandler struct {
	app *app.Application
}

// authorizeAccount loads the account and verifies the user belongs to its
// organization; when manage is true the user must be owner or admin.
func (h *storageAccountHandler) authorize(c fiber.Ctx, accountID, userID uuid.UUID, manage bool) (*models.StorageAccount, error) {
	account, err := h.app.Repositories.StorageAccount.Get(accountID)
	if err != nil {
		return nil, respondError(c, err)
	}

	roles := []string{}
	if manage {
		roles = []string{"owner", "admin"}
	}

	if _, err := requireOrgMember(c, h.app, account.OrganizationID, userID, roles...); err != nil {
		return nil, err
	}

	return account, nil
}

// Connect stores a connected provider account. The credentials object (OAuth
// tokens or access keys) is encrypted by the repository before it is written;
// no decrypted value is ever persisted or returned by this API.
func (h *storageAccountHandler) Connect(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	req := &dtos.CreateStorageAccountRequest{}
	if err := c.Bind().Body(req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	if req.WorkspaceID == uuid.Nil {
		return badRequest(c, "workspace_id is required")
	}
	if req.DisplayName == "" || req.ExternalAccountID == "" {
		return badRequest(c, "display_name and external_account_id are required")
	}
	if len(req.Credentials) == 0 {
		return badRequest(c, "credentials are required")
	}

	workspace, err := h.app.Repositories.Workspace.Get(req.WorkspaceID)
	if err != nil {
		return respondError(c, err)
	}

	if _, err := requireOrgMember(c, h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return err
	}

	var providerID uuid.UUID
	if req.ProviderID != uuid.Nil {
		providerID = req.ProviderID
	} else if req.ProviderSlug != "" {
		provider, err := h.app.Repositories.Provider.GetBySlug(req.ProviderSlug)
		if err != nil {
			return respondError(c, err)
		}
		providerID = provider.ID
	} else {
		return badRequest(c, "provider_id or provider_slug is required")
	}

	account := &models.StorageAccount{
		OrganizationID:    workspace.OrganizationID,
		WorkspaceID:       workspace.ID,
		ProviderID:        providerID,
		OwnerUserID:       userID,
		DisplayName:       req.DisplayName,
		ExternalAccountID: req.ExternalAccountID,
		Settings:          req.Settings,
		Status:            "active",
	}
	if req.AccountEmail != "" {
		account.AccountEmail = &req.AccountEmail
	}

	if err := h.app.Repositories.StorageAccount.Create(account, req.Credentials); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(account)
}

// List returns the workspace's connected accounts. Requires the workspace_id
// query parameter.
func (h *storageAccountHandler) List(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	workspaceParam := c.Queries()["workspace_id"]
	if workspaceParam == "" {
		return badRequest(c, "workspace_id query parameter is required")
	}
	wsID, err := uuid.Parse(workspaceParam)
	if err != nil {
		return badRequest(c, "Invalid workspace_id")
	}

	workspace, err := h.app.Repositories.Workspace.Get(wsID)
	if err != nil {
		return respondError(c, err)
	}

	if _, err := requireOrgMember(c, h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	opts, q, err := pagination(c)
	if err != nil {
		return badRequest(c, "Invalid pagination parameters")
	}

	accounts, metadata, err := h.app.Repositories.StorageAccount.ListByWorkspace(wsID, opts)
	if err != nil {
		return respondError(c, err)
	}

	return listResponse(c, q, metadata.Total, accounts)
}

// Get returns one connected account (never its credentials).
func (h *storageAccountHandler) Get(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := lib.ContextParamUUID(c, "accountId")
	if err != nil {
		return badRequest(c, "Invalid account id")
	}

	account, err := h.authorize(c, accountID, userID, false)
	if err != nil {
		return err
	}

	return c.JSON(account)
}

// Update changes the account's label, settings, or status. Requires owner or
// admin of the organization.
func (h *storageAccountHandler) Update(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := lib.ContextParamUUID(c, "accountId")
	if err != nil {
		return badRequest(c, "Invalid account id")
	}

	account, err := h.authorize(c, accountID, userID, true)
	if err != nil {
		return err
	}

	req := &dtos.UpdateStorageAccountRequest{}
	if err := c.Bind().Body(req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	if req.Status != "" && !contains([]string{"pending_auth", "active", "expired", "revoked", "error"}, req.Status) {
		return badRequest(c, "Invalid status")
	}

	if req.DisplayName != "" {
		account.DisplayName = req.DisplayName
	}
	if len(req.Settings) > 0 {
		account.Settings = req.Settings
	}
	if req.Status != "" {
		account.Status = req.Status
	}

	if err := h.app.Repositories.StorageAccount.Update(accountID, account); err != nil {
		return respondError(c, err)
	}

	return c.JSON(account)
}

// Rotate replaces the stored credentials (e.g. after a token refresh). The
// new value is encrypted by the repository.
func (h *storageAccountHandler) Rotate(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := lib.ContextParamUUID(c, "accountId")
	if err != nil {
		return badRequest(c, "Invalid account id")
	}

	if _, err := h.authorize(c, accountID, userID, true); err != nil {
		return err
	}

	req := &dtos.UpdateCredentialsRequest{}
	if err := c.Bind().Body(req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	if len(req.Credentials) == 0 {
		return badRequest(c, "credentials are required")
	}

	if err := h.app.Repositories.StorageAccount.UpdateCredentials(accountID, req.Credentials); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Credentials updated"})
}

// Disconnect soft-deletes the account. Requires owner or admin of the
// organization.
func (h *storageAccountHandler) Disconnect(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := lib.ContextParamUUID(c, "accountId")
	if err != nil {
		return badRequest(c, "Invalid account id")
	}

	if _, err := h.authorize(c, accountID, userID, true); err != nil {
		return err
	}

	if err := h.app.Repositories.StorageAccount.SoftDelete(accountID); err != nil {
		return respondError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Storage account disconnected"})
}
