package provideroauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cloudrive/server/internal/config"

	"braces.dev/errtrace"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// Profile is the verified identity + quota snapshot fetched from the
// provider right after the token exchange. The account only becomes active
// when this call succeeds.
type Profile struct {
	// Email is the provider account email (drive about / Dropbox account_info
	// / Graph me). Required — connect fails without it.
	Email string
	// Identifier is the provider-native account id (Dropbox account_id,
	// OneDrive driveId, Google email).
	Identifier string
	TotalBytes int64
	UsedBytes  int64
	// Extra lands in the account's encrypted settings JSON (driveId, tenant,
	// displayName, ...).
	Extra map[string]any
}

// Credentials is the provider credential set sealed into the vault after a
// successful exchange/refresh. RefreshToken is mandatory.
type Credentials struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	// ExpiresAt is RFC3339; empty when the provider does not report expiry.
	ExpiresAt string `json:"expires_at,omitempty"`
	Scope     string `json:"scope,omitempty"`
	TokenType string `json:"token_type,omitempty"`
}

// ToOAuth2Token converts stored/refreshed credentials into the stdlib token
// used by TokenSource. Exported so connectors can build their own
// oauth2.TokenSource from vault-decrypted credentials.
func (c Credentials) ToOAuth2Token() *oauth2.Token {
	t := &oauth2.Token{
		AccessToken:  c.AccessToken,
		RefreshToken: c.RefreshToken,
		TokenType:    c.TokenType,
	}
	if c.ExpiresAt != "" {
		if exp, err := time.Parse(time.RFC3339, c.ExpiresAt); err == nil {
			t.Expiry = exp
		}
	}
	return t
}

// credentialsFromOAuth2Token flattens a stdlib token into the vault shape.
func credentialsFromOAuth2Token(t *oauth2.Token) Credentials {
	c := Credentials{
		AccessToken:  t.AccessToken,
		RefreshToken: t.RefreshToken,
		TokenType:    t.TokenType,
	}
	if scope, ok := t.Extra("scope").(string); ok {
		c.Scope = scope
	}
	if !t.Expiry.IsZero() {
		c.ExpiresAt = t.Expiry.UTC().Format(time.RFC3339)
	}
	return c
}

// Flow is one provider's OAuth2 authorization-code flow.
type Flow interface {
	// Slug matches the providers.slug catalog value.
	Slug() string
	// Configured reports whether the server-side client credentials exist.
	Configured() bool
	// AuthorizationURL builds the consent URL for the given state.
	AuthorizationURL(state string) string
	// Exchange trades the callback code for vault credentials. The returned
	// error is already scrubbed of provider detail.
	Exchange(ctx context.Context, code string) (Credentials, Profile, error)
	// Profile re-fetches identity + quota with the given credentials.
	Profile(ctx context.Context, creds Credentials) (Profile, error)
}

// errScrubbed converts provider HTTP failures into a stable message that
// never echoes response bodies (token or user data could appear there).
func errScrubbed(op string, status int) error {
	return errtrace.Errorf("%s failed: provider returned status %d", op, status)
}

// errBody reads a bounded JSON error body for messages that are safe by
// construction (Google/MS/Dropbox `error_description` fields), falling back
// to a generic message.
func errBody(resp *http.Response, fallback string) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	var payload struct {
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if json.Unmarshal(body, &payload) == nil && payload.Description != "" {
		return errtrace.Errorf("%s", payload.Description)
	}
	return errtrace.Errorf("%s", fallback)
}

// --- Google Drive ---

type GoogleDriveFlow struct {
	conf    *oauth2.Config
	client  *http.Client
	nowFunc func() time.Time
}

func NewGoogleDriveFlow(cfg config.ConfigGoogle, serverURL string, client *http.Client) *GoogleDriveFlow {
	return &GoogleDriveFlow{
		conf: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			Endpoint:     google.Endpoint,
			RedirectURL:  redirectURL(serverURL, "google_drive"),
			Scopes: []string{
				"openid",
				"email",
				"profile",
				"https://www.googleapis.com/auth/drive",
			},
		},
		client:  client,
		nowFunc: time.Now,
	}
}

func (f *GoogleDriveFlow) Slug() string { return "google_drive" }
func (f *GoogleDriveFlow) Configured() bool {
	return f.conf.ClientID != "" && f.conf.ClientSecret != ""
}
func (f *GoogleDriveFlow) AuthorizationURL(state string) string {
	return f.conf.AuthCodeURL(state, oauth2.SetAuthURLParam("access_type", "offline"), oauth2.SetAuthURLParam("prompt", "consent"))
}

type driveAboutQuota struct {
	User struct {
		EmailAddress string `json:"emailAddress"`
		DisplayName  string `json:"displayName"`
	} `json:"user"`
	Quota struct {
		Limit int64 `json:"limit,string"`
		Usage int64 `json:"usage,string"`
	} `json:"quota"`
}

func (f *GoogleDriveFlow) Exchange(ctx context.Context, code string) (Credentials, Profile, error) {
	tok, err := f.conf.Exchange(ctx, code)
	if err != nil {
		return Credentials{}, Profile{}, errtrace.Wrap(err)
	}

	creds := credentialsFromOAuth2Token(tok)
	if creds.RefreshToken == "" {
		return Credentials{}, Profile{}, errtrace.New("provider did not return a refresh token; reconnect with offline access")
	}

	profile, err := f.Profile(ctx, creds)
	if err != nil {
		return Credentials{}, Profile{}, err
	}

	return creds, profile, nil
}

func (f *GoogleDriveFlow) Profile(ctx context.Context, creds Credentials) (Profile, error) {
	client := f.conf.Client(ctx, creds.ToOAuth2Token())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName),storageQuota(limit,usage)", nil)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return Profile{}, errScrubbed("drive about", resp.StatusCode)
	}

	var about driveAboutQuota
	if err := json.NewDecoder(resp.Body).Decode(&about); err != nil {
		return Profile{}, errtrace.Wrap(err)
	}

	if about.User.EmailAddress == "" {
		return Profile{}, errtrace.New("unable to read Google account email")
	}

	return Profile{
		Email:      about.User.EmailAddress,
		Identifier: about.User.EmailAddress,
		TotalBytes: about.Quota.Limit,
		UsedBytes:  about.Quota.Usage,
		Extra: map[string]any{
			"display_name": about.User.DisplayName,
		},
	}, nil
}

// --- OneDrive (Microsoft Graph) ---

type OneDriveFlow struct {
	conf    *oauth2.Config
	tenant  string
	nowFunc func() time.Time
}

func NewOneDriveFlow(cfg config.ConfigOneDrive, serverURL string) *OneDriveFlow {
	tenant := cfg.Tenant
	if tenant == "" {
		tenant = "common"
	}
	authority := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0", url.PathEscape(tenant))

	return &OneDriveFlow{
		conf: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:  authority + "/authorize",
				TokenURL: authority + "/token",
			},
			RedirectURL: redirectURL(serverURL, "onedrive"),
			Scopes: []string{
				"offline_access",
				"Files.ReadWrite.All",
				"User.Read",
			},
		},
		tenant:  tenant,
		nowFunc: time.Now,
	}
}

func (f *OneDriveFlow) Slug() string     { return "onedrive" }
func (f *OneDriveFlow) Configured() bool { return f.conf.ClientID != "" && f.conf.ClientSecret != "" }
func (f *OneDriveFlow) AuthorizationURL(state string) string {
	return f.conf.AuthCodeURL(state)
}

type graphMe struct {
	Mail string `json:"mail"`
	UPN  string `json:"userPrincipalName"`
}

type graphDrive struct {
	ID        string `json:"id"`
	DriveType string `json:"driveType"`
	Quota     struct {
		Total int64 `json:"total"`
		Used  int64 `json:"used"`
	} `json:"quota"`
}

func (f *OneDriveFlow) profileFromGraph(ctx context.Context, tok *oauth2.Token) (Profile, error) {
	client := f.conf.Client(ctx, tok)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", nil)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	meResp, err := client.Do(req)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	defer meResp.Body.Close()

	if meResp.StatusCode >= 300 {
		return Profile{}, errScrubbed("graph me", meResp.StatusCode)
	}

	var me graphMe
	if err := json.NewDecoder(meResp.Body).Decode(&me); err != nil {
		return Profile{}, errtrace.Wrap(err)
	}

	req, err = http.NewRequestWithContext(ctx, http.MethodGet, "https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,quota", nil)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	driveResp, err := client.Do(req)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	defer driveResp.Body.Close()

	if driveResp.StatusCode >= 300 {
		return Profile{}, errScrubbed("graph drive", driveResp.StatusCode)
	}

	var drive graphDrive
	if err := json.NewDecoder(driveResp.Body).Decode(&drive); err != nil {
		return Profile{}, errtrace.Wrap(err)
	}

	email := me.Mail
	if email == "" {
		email = me.UPN
	}
	if email == "" {
		return Profile{}, errtrace.New("unable to read OneDrive account email")
	}
	if drive.ID == "" {
		return Profile{}, errtrace.New("unable to read OneDrive drive id")
	}

	return Profile{
		Email:      email,
		Identifier: drive.ID,
		TotalBytes: drive.Quota.Total,
		UsedBytes:  drive.Quota.Used,
		Extra: map[string]any{
			"drive_id":   drive.ID,
			"drive_type": drive.DriveType,
		},
	}, nil
}

func (f *OneDriveFlow) Exchange(ctx context.Context, code string) (Credentials, Profile, error) {
	tok, err := f.conf.Exchange(ctx, code)
	if err != nil {
		return Credentials{}, Profile{}, errtrace.Wrap(err)
	}

	creds := credentialsFromOAuth2Token(tok)
	if creds.RefreshToken == "" {
		return Credentials{}, Profile{}, errtrace.New("provider did not return a refresh token; reconnect with offline access")
	}

	profile, err := f.profileFromGraph(ctx, tok)
	if err != nil {
		return Credentials{}, Profile{}, err
	}

	return creds, profile, nil
}

func (f *OneDriveFlow) Profile(ctx context.Context, creds Credentials) (Profile, error) {
	return f.profileFromGraph(ctx, creds.ToOAuth2Token())
}

// --- Dropbox ---

type DropboxFlow struct {
	conf    *oauth2.Config
	client  *http.Client
	nowFunc func() time.Time
}

func NewDropboxFlow(cfg config.ConfigDropbox, serverURL string, client *http.Client) *DropboxFlow {
	return NewDropboxFlowWithEndpoint(cfg, serverURL,
		"https://www.dropbox.com/oauth2/authorize",
		"https://api.dropboxapi.com/oauth2/token", client)
}

// NewDropboxFlowWithEndpoint lets tests point the token endpoint at a stub
// server while keeping the production constructor clean.
func NewDropboxFlowWithEndpoint(cfg config.ConfigDropbox, serverURL, authURL, tokenURL string, client *http.Client) *DropboxFlow {
	return &DropboxFlow{
		conf: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			Endpoint: oauth2.Endpoint{
				// Dropbox issues opaque codes; the stdlib PKCE flow is not
				// needed for the confidential client.
				AuthURL:  authURL,
				TokenURL: tokenURL,
			},
			RedirectURL: redirectURL(serverURL, "dropbox"),
			Scopes: []string{
				"account_info.read",
				"files.metadata.read",
				"files.content.read",
				"files.content.write",
			},
		},
		client:  client,
		nowFunc: time.Now,
	}
}

func (f *DropboxFlow) Slug() string     { return "dropbox" }
func (f *DropboxFlow) Configured() bool { return f.conf.ClientID != "" && f.conf.ClientSecret != "" }
func (f *DropboxFlow) AuthorizationURL(state string) string {
	return f.conf.AuthCodeURL(state, oauth2.SetAuthURLParam("token_access_type", "offline"))
}

type dropboxAccountInfo struct {
	AccountID   string `json:"account_id"`
	Email       string `json:"email"`
	DisplayName struct {
		Display string `json:"display_name"`
	} `json:"name"`
}

type dropboxSpaceUsage struct {
	Used       int64 `json:"used"`
	Allocation struct {
		Individual struct {
			Allocated int64 `json:"allocated"`
		} `json:".tag,omitempty"`
	} `json:"allocation"`
}

func (f *DropboxFlow) fetchProfile(ctx context.Context, accessToken string) (Profile, error) {
	client := f.conf.Client(ctx, &oauth2.Token{AccessToken: accessToken})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.dropboxapi.com/2/users/get_current_account", nil)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return Profile{}, errScrubbed("dropbox account_info", resp.StatusCode)
	}

	var account dropboxAccountInfo
	if err := json.NewDecoder(resp.Body).Decode(&account); err != nil {
		return Profile{}, errtrace.Wrap(err)
	}

	if account.Email == "" {
		return Profile{}, errtrace.New("unable to read Dropbox account email")
	}
	if account.AccountID == "" {
		return Profile{}, errtrace.New("unable to read Dropbox account id")
	}

	req, err = http.NewRequestWithContext(ctx, http.MethodPost, "https://api.dropboxapi.com/2/users/get_space_usage", nil)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	usageResp, err := client.Do(req)
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	defer usageResp.Body.Close()

	if usageResp.StatusCode >= 300 {
		return Profile{}, errScrubbed("dropbox space_usage", usageResp.StatusCode)
	}

	var usage dropboxSpaceUsage
	if err := json.NewDecoder(usageResp.Body).Decode(&usage); err != nil {
		return Profile{}, errtrace.Wrap(err)
	}

	// Dropbox individual allocation carries the quota in
	// allocation.individual.allocated; team accounts surface it elsewhere,
	// so a missing allocation degrades to usage-only.
	total := usage.Allocation.Individual.Allocated

	return Profile{
		Email:      account.Email,
		Identifier: account.AccountID,
		TotalBytes: total,
		UsedBytes:  usage.Used,
		Extra: map[string]any{
			"display_name": account.DisplayName.Display,
			"account_id":   account.AccountID,
		},
	}, nil
}

func (f *DropboxFlow) Exchange(ctx context.Context, code string) (Credentials, Profile, error) {
	tok, err := f.conf.Exchange(ctx, code)
	if err != nil {
		return Credentials{}, Profile{}, errtrace.Wrap(err)
	}

	creds := credentialsFromOAuth2Token(tok)
	if creds.RefreshToken == "" {
		return Credentials{}, Profile{}, errtrace.New("provider did not return a refresh token; reconnect with offline access")
	}

	profile, err := f.fetchProfile(ctx, tok.AccessToken)
	if err != nil {
		return Credentials{}, Profile{}, err
	}

	return creds, profile, nil
}

func (f *DropboxFlow) Profile(ctx context.Context, creds Credentials) (Profile, error) {
	// Dropbox access tokens are short-lived (4h); exchange the refresh token
	// for a fresh one before querying account info.
	tok, err := f.conf.TokenSource(ctx, creds.ToOAuth2Token()).Token()
	if err != nil {
		return Profile{}, errtrace.Wrap(err)
	}
	return f.fetchProfile(ctx, tok.AccessToken)
}

// Refresh renews the stored credentials for any provider flow.
func Refresh(ctx context.Context, flow Flow, creds Credentials) (Credentials, error) {
	tok, err := flowTokenSource(ctx, flow, creds)
	if err != nil {
		return Credentials{}, err
	}

	renewed := credentialsFromOAuth2Token(tok)
	// Dropbox/Google may omit the refresh token on refresh responses; keep
	// the stored one in that case.
	if renewed.RefreshToken == "" {
		renewed.RefreshToken = creds.RefreshToken
	}
	if renewed.RefreshToken == "" {
		return Credentials{}, errtrace.New("refresh failed: no refresh token available")
	}

	return renewed, nil
}

func flowTokenSource(ctx context.Context, flow Flow, creds Credentials) (*oauth2.Token, error) {
	switch f := flow.(type) {
	case *GoogleDriveFlow:
		return f.conf.TokenSource(ctx, creds.ToOAuth2Token()).Token()
	case *OneDriveFlow:
		return f.conf.TokenSource(ctx, creds.ToOAuth2Token()).Token()
	case *DropboxFlow:
		return f.conf.TokenSource(ctx, creds.ToOAuth2Token()).Token()
	default:
		return nil, errtrace.Errorf("unsupported flow %T", flow)
	}
}

func redirectURL(serverURL, slug string) string {
	return strings.TrimSuffix(serverURL, "/") + "/v1/storage/oauth/" + slug + "/callback"
}
