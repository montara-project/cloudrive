package dtos

import (
	"encoding/json"

	"cloudrive/server/internal/lib/validator"

	"github.com/google/uuid"
)

type CreateStorageAccountRequest struct {
	WorkspaceID       uuid.UUID       `json:"workspace_id"`
	ProviderID        uuid.UUID       `json:"provider_id"`
	ProviderSlug      string          `json:"provider_slug"`
	DisplayName       string          `json:"display_name"`
	AccountEmail      string          `json:"account_email"`
	ExternalAccountID string          `json:"external_account_id"`
	Settings          json.RawMessage `json:"settings"`
	Credentials       json.RawMessage `json:"credentials"`
}

func (dto CreateStorageAccountRequest) Validate(v *validator.MapValidator) {
	v.Field("workspace_id").Required().UUID()
	// provider_id or provider_slug identifies the provider; the handler
	// enforces that at least one is present.
	v.Field("provider_id").UUID()
	v.Field("provider_slug").String()
	v.Field("display_name").Required().String()
	v.Field("account_email").Email()
	v.Field("external_account_id").Required().String()
	v.Field("settings")
	v.Field("credentials").Required()
}

type UpdateStorageAccountRequest struct {
	DisplayName string          `json:"display_name"`
	Status      string          `json:"status"`
	Settings    json.RawMessage `json:"settings"`
}

func (dto UpdateStorageAccountRequest) Validate(v *validator.MapValidator) {
	v.Field("display_name").String()
	v.Field("status").WithinS("pending_auth", "active", "expired", "revoked", "error")
	v.Field("settings")
}

type UpdateCredentialsRequest struct {
	Credentials json.RawMessage `json:"credentials"`
}

func (dto UpdateCredentialsRequest) Validate(v *validator.MapValidator) {
	v.Field("credentials").Required()
}

// ListStorageAccountsQuery binds the query params of the account list
// endpoint.
type ListStorageAccountsQuery struct {
	WorkspaceID string `query:"workspace_id"`
}

func (dto ListStorageAccountsQuery) Validate(v *validator.MapValidator) {
	v.Field("workspace_id").Required().UUID()
}
