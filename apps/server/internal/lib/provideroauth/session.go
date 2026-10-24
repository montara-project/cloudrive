// Package provideroauth implements the server-hosted OAuth2
// authorization-code flow for storage providers (Google Drive, OneDrive,
// Dropbox). It replaces OmniCloud's in-memory state Map: the state parameter
// is a signed (HMAC-SHA256), self-expiring token so callbacks survive server
// restarts and work across multiple instances without a session store.
package provideroauth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"braces.dev/errtrace"
)

const (
	// stateVersion is bumped when the state payload layout changes, so old
	// tokens fail verification instead of decoding into garbage.
	stateVersion = "v1"
	// DefaultStateTTL bounds the consent window; the callback must arrive
	// before it expires.
	DefaultStateTTL = 10 * time.Minute
)

var (
	ErrInvalidState      = errors.New("invalid oauth state")
	ErrExpiredState      = errors.New("expired oauth state")
	ErrProviderNotConfig = errors.New("provider oauth is not configured")
)

// StatePayload is the signed content of an OAuth state parameter. It carries
// the connection context so the callback can rebuild the account without any
// server-side session store.
type StatePayload struct {
	WorkspaceID string `json:"workspace_id"`
	UserID      string `json:"user_id"`
	Provider    string `json:"provider"`
	Nonce       string `json:"nonce"`
	ExpiresAt   int64  `json:"expires_at"`
}

// Session issues and verifies OAuth state parameters. The secret must be the
// application secret (APP_SECRET); rotating it invalidates pending states,
// which is acceptable — the user just retries the connect flow.
type Session struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewSession(secret string) *Session {
	return &Session{secret: []byte(secret), ttl: DefaultStateTTL, now: time.Now}
}

// Issue signs a state token for the given connection context.
func (s *Session) Issue(workspaceID, userID, provider string) (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", errtrace.Wrap(err)
	}

	payload := StatePayload{
		WorkspaceID: workspaceID,
		UserID:      userID,
		Provider:    provider,
		Nonce:       base64.RawURLEncoding.EncodeToString(nonce),
		ExpiresAt:   s.now().Add(s.ttl).Unix(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", errtrace.Wrap(err)
	}

	encoded := base64.RawURLEncoding.EncodeToString(body)
	return encoded + "." + s.mac(encoded), nil
}

// Verify checks the state's signature, expiry, and context match. The
// provider argument must equal the provider recorded at issue time — a
// callback from a different provider URL is rejected.
func (s *Session) Verify(state, provider string) (StatePayload, error) {
	encoded, sig, ok := strings.Cut(state, ".")
	if !ok {
		return StatePayload{}, ErrInvalidState
	}

	if !hmac.Equal([]byte(s.mac(encoded)), []byte(sig)) {
		return StatePayload{}, ErrInvalidState
	}

	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return StatePayload{}, ErrInvalidState
	}

	var payload StatePayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return StatePayload{}, ErrInvalidState
	}

	if payload.Provider != provider {
		return StatePayload{}, ErrInvalidState
	}

	if s.now().Unix() > payload.ExpiresAt {
		return StatePayload{}, ErrExpiredState
	}

	return payload, nil
}

func (s *Session) mac(encoded string) string {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(stateVersion + "." + encoded))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// ExternalAccountID normalizes the provider account identity used as the
// storage_accounts unique key (audit finding #2, PRD §9.1): a constant
// prefix keeps identities comparable across providers even when the provider
// hands out different identifier kinds.
func ExternalAccountID(provider, identifier string) string {
	return fmt.Sprintf("%s:%s", provider, identifier)
}

// RedirectURL derives the provider callback URL for a slug.
func RedirectURL(serverURL, slug string) string {
	return strings.TrimSuffix(serverURL, "/") + "/v1/storage/oauth/" + slug + "/callback"
}
