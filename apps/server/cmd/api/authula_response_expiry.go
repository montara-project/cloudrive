package main

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	authulamodels "github.com/Authula/authula/models"
	jwtplugintypes "github.com/Authula/authula/plugins/jwt/types"
)

// tokenIssuingRoutes are the POST endpoints that mint a token pair: the three
// sign-in routes (where jwt.respond_json would otherwise write a bare
// {access_token, refresh_token, token_type} body) and the refresh endpoint
// (whose handler writes {access_token, refresh_token}). Neither shape carries
// the token lifetime, which forced clients to guess it.
var tokenIssuingRoutes = []string{
	"/email-password/sign-in",
	"/email-password/sign-up",
	"/magic-link/exchange",
	"/token/refresh",
}

// newTokenResponseExpiryHook rewrites token-issuing responses to include the
// access token's real lifetime: expires_in (seconds) and expires_at (epoch).
// The expiry is read from the JWT's own exp claim, so it stays correct even
// if the plugin's ExpiresIn config changes.
//
// It runs on HookOnResponse with an order below jwt.respond_json (10): token
// minting has already happened in the After stage, so this hook builds the
// final body itself and marks it Handled — which stops the loop and keeps
// jwt.respond_json from overwriting it with the bare pair.
func newTokenResponseExpiryHook() authulamodels.Hook {
	return authulamodels.Hook{
		Stage: authulamodels.HookOnResponse,
		Order: 5,
		Matcher: func(reqCtx *authulamodels.RequestContext) bool {
			if reqCtx.Request.Method != http.MethodPost {
				return false
			}
			for _, route := range tokenIssuingRoutes {
				if strings.HasSuffix(reqCtx.Request.URL.Path, route) {
					return true
				}
			}
			return false
		},
		Handler: respondWithTokenExpiry,
	}
}

func respondWithTokenExpiry(reqCtx *authulamodels.RequestContext) error {
	accessToken := mintedAccessToken(reqCtx)
	expiresAt, ok := jwtExpiry(accessToken)
	if !ok {
		// No minted token (failed auth) or an unreadable claim: leave the
		// response untouched so jwt.respond_json handles it as before.
		return nil
	}

	payload := map[string]any{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"expires_in":   int(time.Until(expiresAt).Seconds()),
		"expires_at":   expiresAt.Unix(),
	}
	if refresh := mintedRefreshToken(reqCtx); refresh != "" {
		payload["refresh_token"] = refresh
	}

	reqCtx.SetJSONResponse(http.StatusOK, payload)
	reqCtx.Handled = true
	return nil
}

// mintedAccessToken prefers the token minted during the After stage (sign-in
// routes) and falls back to the response body the refresh handler has already
// written.
func mintedAccessToken(reqCtx *authulamodels.RequestContext) string {
	if access, ok := reqCtx.Values[jwtplugintypes.JWTTokenTypeAccess.String()].(string); ok && access != "" {
		return access
	}
	return responseBodyField(reqCtx, "access_token")
}

func mintedRefreshToken(reqCtx *authulamodels.RequestContext) string {
	if refresh, ok := reqCtx.Values[jwtplugintypes.JWTTokenTypeRefresh.String()].(string); ok && refresh != "" {
		return refresh
	}
	return responseBodyField(reqCtx, "refresh_token")
}

// responseBodyField reads a string field from the captured JSON response;
// responses are buffered until the hook pipeline finishes, so rewriting them
// from a later hook is safe.
func responseBodyField(reqCtx *authulamodels.RequestContext, field string) string {
	if !reqCtx.ResponseReady || len(reqCtx.ResponseBody) == 0 {
		return ""
	}
	var body map[string]any
	if err := json.Unmarshal(reqCtx.ResponseBody, &body); err != nil {
		return ""
	}
	if value, ok := body[field].(string); ok {
		return value
	}
	return ""
}

// jwtExpiry decodes the exp claim from a JWT without verifying the signature:
// the token was minted by this very process a moment ago.
func jwtExpiry(token string) (time.Time, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return time.Time{}, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, false
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil || claims.Exp == 0 {
		return time.Time{}, false
	}
	return time.Unix(claims.Exp, 0), true
}
