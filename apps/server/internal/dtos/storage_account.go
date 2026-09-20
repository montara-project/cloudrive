package dtos

import (
	"encoding/json"

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

type UpdateStorageAccountRequest struct {
	DisplayName string          `json:"display_name"`
	Status      string          `json:"status"`
	Settings    json.RawMessage `json:"settings"`
}

type UpdateCredentialsRequest struct {
	Credentials json.RawMessage `json:"credentials"`
}
