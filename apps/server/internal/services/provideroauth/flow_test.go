package provideroauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"cloudrive/server/internal/config"
)

func TestFlowAuthorizationURLs(t *testing.T) {
	serverURL := "https://api.cloudrive.test"
	dropbox := NewDropboxFlow(serverDropboxConfig(), serverURL, http.DefaultClient)
	onedrive := NewOneDriveFlow(oneDriveConfig(), serverURL)
	google := NewGoogleDriveFlow(googleConfig(), serverURL, http.DefaultClient)

	cases := []struct {
		flow       Flow
		wantSubstr []string
	}{
		{
			flow: dropbox,
			wantSubstr: []string{
				"https://www.dropbox.com/oauth2/authorize",
				"token_access_type=offline",
				"state=abc",
				"redirect_uri=https%3A%2F%2Fapi.cloudrive.test%2Fv1%2Fstorage%2Foauth%2Fdropbox%2Fcallback",
			},
		},
		{
			flow: onedrive,
			wantSubstr: []string{
				"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
				"offline_access",
				"state=abc",
			},
		},
		{
			flow: google,
			wantSubstr: []string{
				"https://accounts.google.com/o/oauth2/auth",
				"access_type=offline",
				"prompt=consent",
				"state=abc",
			},
		},
	}

	for _, tc := range cases {
		url := tc.flow.AuthorizationURL("abc")
		for _, want := range tc.wantSubstr {
			if !contains(url, want) {
				t.Errorf("%s AuthorizationURL = %q, missing %q", tc.flow.Slug(), url, want)
			}
		}
	}
}

func TestFlowRedirectURIDerivation(t *testing.T) {
	// Trailing slash on SERVER_URL must not double the slash.
	f := NewOneDriveFlow(oneDriveConfig(), "https://api.cloudrive.test/")
	url := f.AuthorizationURL("s")
	if contains(url, "//v1//storage") || contains(url, "://api.cloudrive.test//v1") {
		t.Errorf("redirect URL malformed: %q", url)
	}
}

// TestFlowExchangeRejectsMissingRefreshToken pins the OmniCloud contract:
// a token response without refresh_token must fail the connect, never store
// an access-token-only credential.
func TestFlowExchangeRejectsMissingRefreshToken(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"at","token_type":"bearer","expires_in":3600}`))
	}))
	defer tokenServer.Close()

	cfg, authURL, tokenURL := dropboxConfigWithTokenURL(tokenServer.URL)
	flow := NewDropboxFlowWithEndpoint(cfg, "https://api.cloudrive.test", authURL, tokenURL, tokenServer.Client())

	if _, _, err := flow.Exchange(context.Background(), "code"); err == nil {
		t.Fatal("Exchange() accepted a token response without refresh_token")
	}
}

// TestFlowExchangeTokenParsing pins the exchange behavior against a stubbed
// token endpoint: the refresh token must be captured and the expiry
// flattened into RFC3339. (The profile fetch that follows in the real flow
// is a separate network step.)
func TestFlowExchangeTokenParsing(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"at","refresh_token":"rt","token_type":"bearer","expires_in":3600,"scope":"files.content.read"}`))
	}))
	defer tokenServer.Close()

	cfg, authURL, tokenURL := dropboxConfigWithTokenURL(tokenServer.URL)
	flow := NewDropboxFlowWithEndpoint(cfg, "https://api.cloudrive.test", authURL, tokenURL, tokenServer.Client())

	tok, err := flow.conf.Exchange(context.Background(), "code")
	if err != nil {
		t.Fatalf("conf.Exchange() error = %v", err)
	}

	creds := credentialsFromOAuth2Token(tok)
	if creds.RefreshToken != "rt" {
		t.Fatalf("RefreshToken = %q, want rt", creds.RefreshToken)
	}
	if _, err := time.Parse(time.RFC3339, creds.ExpiresAt); err != nil {
		t.Fatalf("ExpiresAt not RFC3339: %q", creds.ExpiresAt)
	}
}

// TestRefreshKeepsStoredRefreshToken covers providers that omit refresh_token
// on refresh responses — the stored value must survive.
func TestRefreshKeepsStoredRefreshToken(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"at2","token_type":"bearer","expires_in":3600}`))
	}))
	defer tokenServer.Close()

	cfg, authURL, tokenURL := dropboxConfigWithTokenURL(tokenServer.URL)
	flow := NewDropboxFlowWithEndpoint(cfg, "https://api.cloudrive.test", authURL, tokenURL, tokenServer.Client())

	renewed, err := Refresh(context.Background(), flow, Credentials{RefreshToken: "rt-old"})
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if renewed.RefreshToken != "rt-old" {
		t.Fatalf("RefreshToken = %q, want rt-old preserved", renewed.RefreshToken)
	}
	if renewed.AccessToken != "at2" {
		t.Fatalf("AccessToken = %q, want at2", renewed.AccessToken)
	}
}

func TestCredentialsToOAuth2TokenParsesExpiry(t *testing.T) {
	creds := Credentials{AccessToken: "a", RefreshToken: "r", ExpiresAt: "2030-01-01T00:00:00Z"}
	tok := creds.ToOAuth2Token()
	if tok.AccessToken != "a" || tok.RefreshToken != "r" {
		t.Fatalf("token fields mismatch: %+v", tok)
	}
	if tok.Expiry.IsZero() || tok.Expiry.Year() != 2030 {
		t.Fatalf("Expiry not parsed: %v", tok.Expiry)
	}
}

// TestCredentialsToOAuth2TokenToleratesBadExpiry: a corrupt timestamp must
// not panic; the token just loses its expiry (TokenSource re-authenticates).
func TestCredentialsToOAuth2TokenToleratesBadExpiry(t *testing.T) {
	creds := Credentials{AccessToken: "a", RefreshToken: "r", ExpiresAt: "not-a-time"}
	tok := creds.ToOAuth2Token()
	if !tok.Expiry.IsZero() {
		t.Fatalf("Expiry should be zero for unparsable value, got %v", tok.Expiry)
	}
}

// --- test helpers ---

func googleConfig() config.ConfigGoogle {
	return config.ConfigGoogle{ClientID: "gid", ClientSecret: "gsec"}
}

func oneDriveConfig() config.ConfigOneDrive {
	return config.ConfigOneDrive{ClientID: "oid", ClientSecret: "osec", Tenant: "common"}
}

func serverDropboxConfig() config.ConfigDropbox {
	return config.ConfigDropbox{ClientID: "did", ClientSecret: "dsec"}
}

func dropboxConfigWithTokenURL(tokenURL string) (config.ConfigDropbox, string, string) {
	return config.ConfigDropbox{ClientID: "did", ClientSecret: "dsec"},
		"https://www.dropbox.com/oauth2/authorize",
		tokenURL
}

func contains(s, sub string) bool {
	return strings.Contains(s, sub)
}
