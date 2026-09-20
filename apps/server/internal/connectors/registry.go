package connectors

import (
	"encoding/json"
	"fmt"

	"cloudrive/server/internal/models"

	"github.com/google/uuid"
)

// Credentials is the decrypted content of a storage account's vault row,
// unmarshalled per protocol by the connector constructors.
type Credentials map[string]any

func parseCredentials(accountID, credentialsJSON string) (Credentials, error) {
	if credentialsJSON == "" {
		return nil, fmt.Errorf("storage account %s has no decrypted credentials", accountID)
	}

	var creds Credentials
	if err := json.Unmarshal([]byte(credentialsJSON), &creds); err != nil {
		return nil, fmt.Errorf("parse credentials for account %s: %w", accountID, err)
	}

	return creds, nil
}

func (c Credentials) string(key string) string {
	v, _ := c[key].(string)
	return v
}

// bool reads a boolean credential that may be stored as JSON bool or string.
func (c Credentials) bool(key string) bool {
	switch v := c[key].(type) {
	case bool:
		return v
	case string:
		return v == "true" || v == "1"
	default:
		return false
	}
}

// AccountInput is what a connector needs to reach the backing storage: the
// account identity plus its settings JSON (endpoint overrides, root paths).
type AccountInput struct {
	ID       uuid.UUID
	Settings json.RawMessage
}

// Registry builds connectors for connected storage accounts. It is
// stateless: connectors are created per request from the account's settings
// and freshly decrypted credentials, so rotated keys and status changes take
// effect immediately without cache invalidation.
type Registry struct {
	// GoogleClientID/Secret are the OAuth client credentials used to refresh
	// Google Drive access tokens.
	GoogleClientID     string
	GoogleClientSecret string
	// StagingDir is where multipart parts for non-passthrough backends are
	// buffered before being joined on complete.
	StagingDir string
}

// New returns a Connector for the account based on its provider protocol.
// credentialsJSON must be the decrypted credentials JSON for the account.
func (reg Registry) New(account AccountInput, provider *models.Provider, credentialsJSON string) (Connector, error) {
	creds, err := parseCredentials(account.ID.String(), credentialsJSON)
	if err != nil {
		return nil, err
	}

	switch provider.Protocol {
	case "s3_compatible":
		return newS3Connector(account, creds)
	case "oauth2_cloud":
		return newGoogleDriveConnector(reg, account, creds)
	default:
		return nil, fmt.Errorf("protocol %q is not supported by the S3 gateway", provider.Protocol)
	}
}
