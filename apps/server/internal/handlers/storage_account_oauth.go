package handlers

import (
	"context"
	"encoding/json"
	"net/url"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
	"cloudrive/server/internal/lib/connectors"
	"cloudrive/server/internal/lib/provideroauth"
	"cloudrive/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type storageAccountOAuthHandler struct {
	app *app.Application
	// providerSlug is set by authorizeOAuthAccount for flowForAccount.
	providerSlug string
}

// Authorize starts the OAuth connect flow: it verifies the caller may manage
// the workspace, checks the provider exists and is configured, and returns
// the provider consent URL with a signed state the callback will verify.
func (h *storageAccountOAuthHandler) Authorize(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	slug := c.Params("provider_slug")
	req := &dtos.AuthorizeStorageOAuthRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}
	wsID, err := uuid.Parse(req.WorkspaceID)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "Invalid workspace_id")
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), wsID)
	if err != nil {
		return err
	}
	if _, err := requireOrgMember(c.Context(), h.app, workspace.OrganizationID, userID, "owner", "admin"); err != nil {
		return err
	}

	provider, err := h.app.Repositories.Provider.GetBySlug(c.Context(), slug)
	if err != nil {
		return err
	}
	if provider.Protocol != "oauth2_cloud" {
		return apperr.New(apperr.KindBadRequest, "Provider does not support OAuth connect")
	}

	flow := ConnectorRegistry(h.app).Flow(slug)
	if flow == nil || !flow.Configured() {
		return apperr.New(apperr.KindBadRequest, "Provider OAuth is not configured on the server")
	}

	state, err := oauthSession(h.app).Issue(wsID.String(), userID.String(), slug)
	if err != nil {
		return err
	}

	return dtos.OK(c, fiber.Map{
		"provider":          slug,
		"authorization_url": flow.AuthorizationURL(state),
		"state":             state,
		"redirect_uri":      provideroauth.RedirectURL(h.app.Config.App.ServerURL, slug),
	})
}

// Callback completes the flow: verify state, exchange the code, fetch and
// verify the provider profile, then upsert the storage account + vault row.
// Responses are redirects to CLIENT_URL; the state HMAC is the only
// protection on this unauthenticated endpoint.
func (h *storageAccountOAuthHandler) Callback(c fiber.Ctx) error {
	slug := c.Params("provider_slug")
	clientURL := h.app.Config.App.ClientURL

	redirectErr := func(reason string) error {
		c.Set(fiber.HeaderLocation, clientURL+"/storage?connected="+url.QueryEscape(slug)+"&status=error&reason="+url.QueryEscape(reason))
		return c.SendStatus(fiber.StatusFound)
	}

	state := c.Query("state")
	if state == "" || c.Query("error") != "" {
		return redirectErr("consent_failed")
	}

	payload, err := oauthSession(h.app).Verify(state, slug)
	if err != nil {
		return redirectErr("invalid_state")
	}

	flow := ConnectorRegistry(h.app).Flow(slug)
	if flow == nil || !flow.Configured() {
		return redirectErr("provider_not_configured")
	}

	code := c.Query("code")
	if code == "" {
		return redirectErr("missing_code")
	}

	creds, profile, err := flow.Exchange(c.Context(), code)
	if err != nil {
		h.app.Logger.Error("provider oauth exchange failed", "provider", slug, "error", err)
		return redirectErr("exchange_failed")
	}

	workspaceID, err := uuid.Parse(payload.WorkspaceID)
	if err != nil {
		return redirectErr("invalid_state")
	}
	userID, err := uuid.Parse(payload.UserID)
	if err != nil {
		return redirectErr("invalid_state")
	}

	workspace, err := h.app.Repositories.Workspace.Get(c.Context(), workspaceID)
	if err != nil {
		return redirectErr("workspace_not_found")
	}

	provider, err := h.app.Repositories.Provider.GetBySlug(c.Context(), slug)
	if err != nil {
		return redirectErr("provider_not_found")
	}

	if err := h.upsertConnectedAccount(c.Context(), workspace, provider, userID, credentialsMap(creds), profile); err != nil {
		h.app.Logger.Error("provider oauth connect failed", "provider", slug, "error", err)
		return redirectErr("persist_failed")
	}

	c.Set(fiber.HeaderLocation, clientURL+"/storage?connected="+url.QueryEscape(slug)+"&status=ok")
	return c.SendStatus(fiber.StatusFound)
}

// upsertConnectedAccount writes or refreshes the (workspace, provider,
// external account) row and re-seals its credentials in one transaction
// through the repository's Create (insert + vault upsert) or Rotate path.
func (h *storageAccountOAuthHandler) upsertConnectedAccount(
	ctx context.Context,
	workspace models.Workspace,
	provider models.Provider,
	userID uuid.UUID,
	creds connectors.Credentials,
	profile provideroauth.Profile,
) error {
	externalID := provideroauth.ExternalAccountID(provider.Slug, profile.Identifier)

	existing, err := h.app.Repositories.StorageAccount.GetByExternalAccount(ctx, workspace.ID, provider.ID, externalID)
	if err != nil && !isNotFound(err) {
		return err
	}

	settings := buildAccountSettings(provider.Slug, profile)

	if existing.ID != uuid.Nil {
		// Reconnect: refresh credentials, quota-driven settings, and flip the
		// status back to active.
		if err := h.app.Repositories.StorageAccount.UpdateCredentials(ctx, existing.ID, marshalCredentials(creds)); err != nil {
			return err
		}
		existing.Settings = settings
		existing.Status = "active"
		if profile.Email != "" {
			existing.AccountEmail = &profile.Email
		}
		return h.app.Repositories.StorageAccount.Update(ctx, existing)
	}

	account := models.StorageAccount{
		OrganizationID:    workspace.OrganizationID,
		WorkspaceID:       workspace.ID,
		ProviderID:        provider.ID,
		OwnerUserID:       userID,
		DisplayName:       displayName(provider.Name, profile),
		ExternalAccountID: externalID,
		Settings:          settings,
		Status:            "active",
	}
	if profile.Email != "" {
		account.AccountEmail = &profile.Email
	}
	if account.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	return h.app.Repositories.StorageAccount.Create(ctx, account, marshalCredentials(creds))
}

// marshalCredentials encodes the credential payload as the JSON document the
// vault seals: the flow's Credentials struct from connect/refresh, or the
// JSON-shaped map parsed from the vault. Field names match what connectors
// parse back.
func marshalCredentials(creds any) []byte {
	raw, err := json.Marshal(creds)
	if err != nil {
		return []byte("{}")
	}
	return raw
}

// credentialsMap flattens flow credentials into the JSON-shaped map the
// vault stores (and connectors later parse back via Credentials helpers).
func credentialsMap(c provideroauth.Credentials) connectors.Credentials {
	raw, err := json.Marshal(c)
	if err != nil {
		return connectors.Credentials{}
	}
	out := connectors.Credentials{}
	_ = json.Unmarshal(raw, &out)
	return out
}

// credentialsFromMap parses vault credentials back into flow credentials.
func credentialsFromMap(m connectors.Credentials) provideroauth.Credentials {
	raw, err := json.Marshal(m)
	if err != nil {
		return provideroauth.Credentials{}
	}
	out := provideroauth.Credentials{}
	_ = json.Unmarshal(raw, &out)
	return out
}

// buildAccountSettings merges the profile extras (drive_id, display_name,
// ...) into the account settings so connectors can resolve them without
// decrypting credentials.
func buildAccountSettings(slug string, profile provideroauth.Profile) json.RawMessage {
	settings := map[string]any{}
	for k, v := range profile.Extra {
		settings[k] = v
	}
	raw, err := json.Marshal(settings)
	if err != nil {
		return nil
	}
	return raw
}

func displayName(providerName string, profile provideroauth.Profile) string {
	if profile.Email != "" {
		return providerName + " — " + profile.Email
	}
	return providerName
}

// Refresh re-fetches and re-seals the account's OAuth credentials (manual
// maintenance path; connectors also refresh transparently via TokenSource).
func (h *storageAccountOAuthHandler) Refresh(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := pathID(c, "accountId", "Invalid account id")
	if err != nil {
		return err
	}

	account, err := h.authorizeOAuthAccount(c, accountID, userID, true)
	if err != nil {
		return err
	}

	flow, creds, err := h.flowForAccount(c.Context(), account)
	if err != nil {
		return err
	}

	renewed, err := provideroauth.Refresh(c.Context(), flow, credentialsFromMap(creds))
	if err != nil {
		_ = h.app.Repositories.StorageAccount.UpdateStatus(c.Context(), account.ID, "expired")
		h.app.Logger.Error("provider oauth refresh failed", "account", account.ID, "error", err)
		return apperr.New(apperr.KindBadGateway, "Token refresh failed; account marked expired")
	}

	if err := h.app.Repositories.StorageAccount.UpdateCredentials(c.Context(), account.ID, marshalCredentials(renewed)); err != nil {
		return err
	}
	if account.Status != "active" {
		if err := h.app.Repositories.StorageAccount.UpdateStatus(c.Context(), account.ID, "active"); err != nil {
			return err
		}
	}

	return dtos.OK(c, fiber.Map{"status": "refreshed"})
}

// Quota returns the provider-reported storage quota for one account.
func (h *storageAccountOAuthHandler) Quota(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	accountID, err := pathID(c, "accountId", "Invalid account id")
	if err != nil {
		return err
	}

	account, err := h.authorizeOAuthAccount(c, accountID, userID, false)
	if err != nil {
		return err
	}

	flow, creds, err := h.flowForAccount(c.Context(), account)
	if err != nil {
		return err
	}

	profile, err := flow.Profile(c.Context(), credentialsFromMap(creds))
	if err != nil {
		h.app.Logger.Error("provider quota fetch failed", "account", account.ID, "error", err)
		return apperr.New(apperr.KindBadGateway, "Provider quota fetch failed")
	}

	return dtos.OK(c, fiber.Map{
		"total_bytes": profile.TotalBytes,
		"used_bytes":  profile.UsedBytes,
	})
}

// authorizeOAuthAccount loads the account and enforces membership; manage
// restricts to owner/admin. Only OAuth provider accounts are eligible.
func (h *storageAccountOAuthHandler) authorizeOAuthAccount(c fiber.Ctx, accountID, userID uuid.UUID, manage bool) (models.StorageAccount, error) {
	account, err := h.app.Repositories.StorageAccount.Get(c.Context(), accountID)
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

	_, provider, err := h.app.Repositories.StorageAccount.GetWithProvider(c.Context(), accountID)
	if err != nil {
		return models.StorageAccount{}, err
	}
	if provider.Protocol != "oauth2_cloud" {
		return models.StorageAccount{}, apperr.New(apperr.KindBadRequest, "account is not an OAuth provider account")
	}
	h.providerSlug = provider.Slug

	return account, nil
}

// flowForAccount resolves the provider flow and decrypts credentials.
func (h *storageAccountOAuthHandler) flowForAccount(ctx context.Context, account models.StorageAccount) (provideroauth.Flow, connectors.Credentials, error) {
	slug := h.providerSlug
	flow := ConnectorRegistry(h.app).Flow(slug)
	if flow == nil || !flow.Configured() {
		return nil, nil, apperr.New(apperr.KindBadRequest, "Provider OAuth is not configured on the server")
	}

	raw, err := h.app.Repositories.StorageAccount.Credentials(ctx, account.ID)
	if err != nil {
		return nil, nil, err
	}

	var creds connectors.Credentials
	if err := json.Unmarshal(raw, &creds); err != nil {
		return nil, nil, err
	}
	return flow, creds, nil
}
