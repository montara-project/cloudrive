package secretbox

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"
)

func b64(s string) string {
	return base64.StdEncoding.EncodeToString([]byte(s))
}

func mustBox(t *testing.T, spec string) *SecretBox {
	t.Helper()
	box, err := NewSecretBox(spec)
	if err != nil {
		t.Fatalf("NewSecretBox(%q): %v", spec, err)
	}
	return box
}

func TestRoundTrip(t *testing.T) {
	box := mustBox(t, "v1:"+b64(strings.Repeat("k", 32)))

	secret := []byte(`{"access_token":"ya29.super-secret","refresh_token":"1//0abc"}`)

	encoded, err := box.Encrypt(secret)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	if !strings.HasPrefix(encoded, "v1:") {
		t.Errorf("blob should be prefixed with the active key id, got %q", encoded)
	}
	if strings.Contains(encoded, "ya29") {
		t.Errorf("plaintext leaked into blob: %q", encoded)
	}

	decoded, err := box.Decrypt(encoded)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if !bytes.Equal(decoded, secret) {
		t.Errorf("round trip mismatch: got %q, want %q", decoded, secret)
	}
}

func TestEncryptIsRandomized(t *testing.T) {
	box := mustBox(t, "v1:"+b64(strings.Repeat("k", 32)))

	first, err := box.Encrypt([]byte("same plaintext"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	second, err := box.Encrypt([]byte("same plaintext"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	if first == second {
		t.Error("encrypting the same plaintext twice must produce different blobs")
	}

	for _, blob := range []string{first, second} {
		decoded, err := box.Decrypt(blob)
		if err != nil {
			t.Fatalf("Decrypt: %v", err)
		}
		if string(decoded) != "same plaintext" {
			t.Errorf("Decrypt = %q, want %q", decoded, "same plaintext")
		}
	}
}

func TestTamperedBlobFails(t *testing.T) {
	box := mustBox(t, "v1:"+b64(strings.Repeat("k", 32)))

	encoded, err := box.Encrypt([]byte("do not touch"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	parts := strings.Split(encoded, ":")
	sealed, err := base64.StdEncoding.DecodeString(parts[2])
	if err != nil {
		t.Fatalf("decode sealed part: %v", err)
	}
	sealed[0] ^= 0x01
	tampered := parts[0] + ":" + parts[1] + ":" + base64.StdEncoding.EncodeToString(sealed)

	if _, err := box.Decrypt(tampered); err != ErrAuthentication {
		t.Errorf("Decrypt(tampered) error = %v, want ErrAuthentication", err)
	}
}

func TestRotation(t *testing.T) {
	oldSpec := "v1:" + b64(strings.Repeat("a", 32))
	oldBox := mustBox(t, oldSpec)

	encoded, err := oldBox.Encrypt([]byte("rotating away"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	// New key becomes active; the old key stays configured for decryption only.
	rotated := mustBox(t, "v2:"+b64(strings.Repeat("b", 32))+",v1:"+b64(strings.Repeat("a", 32)))
	if rotated.ActiveKeyID() != "v2" {
		t.Errorf("ActiveKeyID = %q, want v2", rotated.ActiveKeyID())
	}

	decoded, err := rotated.Decrypt(encoded)
	if err != nil {
		t.Fatalf("Decrypt(blob sealed by old key): %v", err)
	}
	if string(decoded) != "rotating away" {
		t.Errorf("Decrypt = %q", decoded)
	}

	fresh, err := rotated.Encrypt([]byte("sealed by new key"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if !strings.HasPrefix(fresh, "v2:") {
		t.Errorf("new encryptions must use the active key, got %q", fresh)
	}

	// Once the old key is dropped, its blobs can no longer be opened.
	if _, err := mustBox(t, "v2:"+b64(strings.Repeat("b", 32))).Decrypt(encoded); err != ErrKeyNotFound {
		t.Errorf("Decrypt without old key error = %v, want ErrKeyNotFound", err)
	}
}

func TestInvalidSpecs(t *testing.T) {
	cases := map[string]string{
		"empty":          "",
		"missing key":    "v1:",
		"missing id":     ":" + b64(strings.Repeat("k", 32)),
		"bad base64":     "v1:not-base64!!",
		"short key":      "v1:" + b64("too-short"),
		"long key":       "v1:" + b64(strings.Repeat("k", 33)),
		"bad key id":     "v 1:" + b64(strings.Repeat("k", 32)),
		"duplicate id":   "v1:" + b64(strings.Repeat("k", 32)) + ",v1:" + b64(strings.Repeat("j", 32)),
		"no colon":       "v1" + b64(strings.Repeat("k", 32)),
		"extra segments": "v1:" + b64(strings.Repeat("k", 32)) + ",v2",
	}

	for name, spec := range cases {
		if _, err := NewSecretBox(spec); err == nil {
			t.Errorf("%s: NewSecretBox(%q) succeeded, want error", name, spec)
		}
	}
}

func TestDecryptInvalidBlobs(t *testing.T) {
	box := mustBox(t, "v1:"+b64(strings.Repeat("k", 32)))

	cases := map[string]string{
		"no separators":  "garbage",
		"too many parts": "v1:aaa:bbb:ccc",
		"unknown key":    "v9:aaa:bbb",
		"bad nonce b64":  "v1:!!:bbb",
		"bad sealed b64": "v1:aaa:!!",
		"truncated seal": "v1:" + b64(strings.Repeat("n", 12)) + ":" + b64("x"),
	}

	for name, blob := range cases {
		if _, err := box.Decrypt(blob); err == nil {
			t.Errorf("%s: Decrypt(%q) succeeded, want error", name, blob)
		}
	}
}
