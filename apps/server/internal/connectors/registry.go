package connectors

import (
	"encoding/json"
	"fmt"
	"net/http"

	"cloudrive/server/internal/config"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/services/provideroauth"

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

// OAuth reads the credential keys an oauth2.TokenSource needs. The zero
// RefreshToken makes callers fail closed (connectors require it).
func (c Credentials) OAuth() provideroauth.Credentials {
	var expiresAt string
	if v, ok := c["expires_at"].(string); ok {
		expiresAt = v
	}
	var scope string
	if v, ok := c["scope"].(string); ok {
		scope = v
	}
	var tokenType string
	if v, ok := c["token_type"].(string); ok {
		tokenType = v
	}
	return provideroauth.Credentials{
		AccessToken:  c.string("access_token"),
		RefreshToken: c.string("refresh_token"),
		ExpiresAt:    expiresAt,
		Scope:        scope,
		TokenType:    tokenType,
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
	// OneDrive/Dropbox OAuth client credentials for their connectors.
	OneDriveClientID     string
	OneDriveClientSecret string
	OneDriveTenant       string
	DropboxClientID      string
	DropboxClientSecret  string
	// ServerURL derives provider OAuth redirect URLs.
	ServerURL string
	// StagingDir is where multipart parts for non-passthrough backends are
	// buffered before being joined on complete.
	StagingDir string
}

// Flow returns the OAuth flow for an oauth2_cloud provider slug, or nil when
// the provider is not an OAuth provider or its client credentials are unset.
func (reg Registry) Flow(slug string) provideroauth.Flow {
	switch slug {
	case "google_drive":
		return provideroauth.NewGoogleDriveFlow(
			config.ConfigGoogle{ClientID: reg.GoogleClientID, ClientSecret: reg.GoogleClientSecret},
			reg.ServerURL, http.DefaultClient,
		)
	case "onedrive":
		return provideroauth.NewOneDriveFlow(
			config.ConfigOneDrive{ClientID: reg.OneDriveClientID, ClientSecret: reg.OneDriveClientSecret, Tenant: reg.OneDriveTenant},
			reg.ServerURL,
		)
	case "dropbox":
		return provideroauth.NewDropboxFlow(
			config.ConfigDropbox{ClientID: reg.DropboxClientID, ClientSecret: reg.DropboxClientSecret},
			reg.ServerURL, http.DefaultClient,
		)
	default:
		return nil
	}
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
		switch provider.Slug {
		case "google_drive":
			return newGoogleDriveConnector(reg, account, creds)
		case "dropbox":
			return newDropboxConnector(reg, account, creds)
		case "onedrive":
			return newOneDriveConnector(reg, account, creds)
		default:
			return nil, fmt.Errorf("provider %q is not supported by the S3 gateway", provider.Slug)
		}
	default:
		return nil, fmt.Errorf("protocol %q is not supported by the S3 gateway", provider.Protocol)
	}
}
