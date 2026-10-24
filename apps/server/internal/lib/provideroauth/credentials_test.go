package provideroauth

import (
	"encoding/json"
	"testing"
)

// TestCredentialsJSONShapeMatchesConnector pins the vault document contract:
// connectors parse credentials as a JSON map with snake_case keys
// (connectors.Credentials.string("refresh_token") etc.), so any rename here
// must be mirrored there.
func TestCredentialsJSONShapeMatchesConnector(t *testing.T) {
	creds := Credentials{
		AccessToken:  "at",
		RefreshToken: "rt",
		ExpiresAt:    "2030-01-01T00:00:00Z",
		Scope:        "files.content.read",
		TokenType:    "bearer",
	}

	raw, err := json.Marshal(creds)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}

	var asMap map[string]any
	if err := json.Unmarshal(raw, &asMap); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}

	for _, key := range []string{"access_token", "refresh_token", "expires_at", "scope", "token_type"} {
		if _, ok := asMap[key]; !ok {
			t.Errorf("vault document missing key %q: %s", key, raw)
		}
	}

	// Round-trip through the map shape connectors use.
	var back Credentials
	if err := json.Unmarshal(raw, &back); err != nil {
		t.Fatalf("round-trip Unmarshal() error = %v", err)
	}
	if back != creds {
		t.Fatalf("round-trip mismatch: %+v vs %+v", back, creds)
	}
}
