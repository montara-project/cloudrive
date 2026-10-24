package handlers

import (
	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type storageAccountHandler struct {
	app *app.Application
}

func (h *storageAccountHandler) repo() *repositories.StorageAccountRepository {
	return &h.app.Repositories.StorageAccount
}

// authorizeAccount loads the account and verifies the user belongs to its
// organization; when manage is true the user must be owner or admin.
func (h *storageAccountHandler) authorize(c fiber.Ctx, accountID, userID uuid.UUID, manage bool) (models.StorageAccount, error) {
	account, err := h.repo().Get(c.Context(), accountID)
	if err != nil {
		return models.StorageAccount{}, err
	}

	roles := []string{}
	if manage {
		roles = []string{"owner", "admin"}
	}

	if _, err := requireOrgMember(c.Context(), h.app, account.OrganizationID, userID, roles...); err != nil {
		return models.StorageAccount{}, err
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
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}
	if req.WorkspaceID == uuid.Nil {
		return apperr.New(apperr.KindBadRequest, "workspace_id is required")
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), req.WorkspaceID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return err
	}

	var providerID uuid.UUID
	if req.ProviderID != uuid.Nil {
		providerID = req.ProviderID
	} else if req.ProviderSlug != "" {
		provider, err := h.app.Repositories.Provider.GetBySlug(c.Context(), req.ProviderSlug)
		if err != nil {
			return err
		}
		providerID = provider.ID
	} else {
		return apperr.New(apperr.KindBadRequest, "provider_id or provider_slug is required")
	}

	account := models.StorageAccount{
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
	if account.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	if err := h.repo().Create(c.Context(), account, req.Credentials); err != nil {
		return err
	}

	// Re-read so the response carries the DB-set timestamps.
	account, err = h.repo().Get(c.Context(), account.ID)
	if err != nil {
		return err
	}
	return dtos.Created(c, account, "Storage account connected")
}

// List returns the workspace's connected accounts. Requires the workspace_id
// query parameter.
func (h *storageAccountHandler) List(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	lq := &dtos.ListStorageAccountsQuery{}
	if err := lib.ValidateRequestQuery(c, lq); err != nil {
		return err
	}
	wsID, err := uuid.Parse(lq.WorkspaceID)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "Invalid workspace_id")
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return err
	}

	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID); err != nil {
		return err
	}

	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	accounts, err := h.repo().ListByWorkspace(c.Context(), wsID, params)
	if err != nil {
		return err
	}
	total, err := h.repo().CountByWorkspace(c.Context(), wsID)
	if err != nil {
		return err
	}

	return dtos.List(c, accounts, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

// Get returns one connected account (never its credentials).
func (h *storageAccountHandler) Get(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := pathID(c, "accountId", "Invalid account id")
	if err != nil {
		return err
	}

	account, err := h.authorize(c, accountID, userID, false)
	if err != nil {
		return err
	}

	return dtos.OK(c, account)
}

// Update changes the account's label, settings, or status. Requires owner or
// admin of the organization.
func (h *storageAccountHandler) Update(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := pathID(c, "accountId", "Invalid account id")
	if err != nil {
		return err
	}

	account, err := h.authorize(c, accountID, userID, true)
	if err != nil {
		return err
	}

	req := &dtos.UpdateStorageAccountRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
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

	if err := h.repo().Update(c.Context(), account); err != nil {
		return err
	}

	account, err = h.repo().Get(c.Context(), accountID)
	if err != nil {
		return err
	}
	return dtos.OK(c, account)
}

// Rotate replaces the stored credentials (e.g. after a token refresh). The
// new value is encrypted by the repository.
func (h *storageAccountHandler) Rotate(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := pathID(c, "accountId", "Invalid account id")
	if err != nil {
		return err
	}

	if _, err := h.authorize(c, accountID, userID, true); err != nil {
		return err
	}

	req := &dtos.UpdateCredentialsRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	if err := h.repo().UpdateCredentials(c.Context(), accountID, req.Credentials); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Credentials updated")
}

// Disconnect soft-deletes the account. Requires owner or admin of the
// organization.
func (h *storageAccountHandler) Disconnect(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := pathID(c, "accountId", "Invalid account id")
	if err != nil {
		return err
	}

	if _, err := h.authorize(c, accountID, userID, true); err != nil {
		return err
	}

	if err := h.repo().Delete(c.Context(), accountID); err != nil {
		return err
	}

	return dtos.Message(c, fiber.StatusOK, "Storage account disconnected")
}
