// Package secretbox provides authenticated encryption for provider
// credentials (OAuth tokens, access keys) before they touch the database.
//
// Blobs are sealed with AES-256-GCM using keys supplied through configuration
// and are stored in the self-describing form
//
//	key_id:base64(nonce):base64(ciphertext||tag)
//
// so decryption dispatches on the key_id prefix. That makes key rotation a
// config change: add the new key first, re-encrypt rows at leisure, then drop
// the old key once nothing references it anymore.
package secretbox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const (
	keyLen     = 32 // AES-256
	nonceLen   = 12 // GCM standard nonce
	maxKeyID   = 32
	maxPayload = 1 << 20 // refuse absurdly large inputs (1 MiB)
)

// ErrInvalidSpec is returned when the configured key spec is malformed.
var ErrInvalidSpec = errors.New("secretbox: invalid key spec")

// ErrInvalidBlob is returned for encrypted payloads that are not in the
// expected key_id:nonce:ciphertext form.
var ErrInvalidBlob = errors.New("secretbox: invalid encrypted payload")

// ErrKeyNotFound is returned when a blob references a key_id that is not
// configured (e.g. the key was rotated away too early).
var ErrKeyNotFound = errors.New("secretbox: key id not configured")

// ErrAuthentication is returned when decryption fails the GCM authenticity
// check: wrong key, tampered ciphertext, or corrupted nonce.
var ErrAuthentication = errors.New("secretbox: decryption failed authentication")

// SecretBox seals and opens credential payloads with AES-256-GCM.
type SecretBox struct {
	keys       map[string][]byte
	activeID   string
	activeAEAD cipher.AEAD
}

// NewSecretBox parses a key spec of comma-separated "key_id:base64" entries,
// where each base64 value decodes to a 32-byte AES-256 key. The first entry is
// the active key used for encryption; the rest are older keys kept only for
// decryption during rotation.
func NewSecretBox(spec string) (*SecretBox, error) {
	if strings.TrimSpace(spec) == "" {
		return nil, fmt.Errorf("%w: key spec is empty", ErrInvalidSpec)
	}

	box := &SecretBox{keys: make(map[string][]byte)}

	for i, entry := range strings.Split(spec, ",") {
		id, key, err := parseEntry(entry)
		if err != nil {
			return nil, err
		}
		if _, dup := box.keys[id]; dup {
			return nil, fmt.Errorf("%w: duplicate key id %q", ErrInvalidSpec, id)
		}

		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, fmt.Errorf("%w: key %q: %v", ErrInvalidSpec, id, err)
		}
		aead, err := cipher.NewGCM(block)
		if err != nil {
			return nil, fmt.Errorf("%w: key %q: %v", ErrInvalidSpec, id, err)
		}

		box.keys[id] = key
		if i == 0 {
			box.activeID = id
			box.activeAEAD = aead
		}
	}

	return box, nil
}

// ActiveKeyID reports the key id used for new encryptions.
func (b *SecretBox) ActiveKeyID() string {
	return b.activeID
}

// Encrypt seals plaintext with the active key and returns the self-describing
// blob for storage. The nonce is random per call, so encrypting the same
// plaintext twice yields different blobs.
func (b *SecretBox) Encrypt(plaintext []byte) (string, error) {
	if len(plaintext) > maxPayload {
		return "", fmt.Errorf("secretbox: plaintext too large (%d bytes)", len(plaintext))
	}

	nonce := make([]byte, nonceLen)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("secretbox: reading nonce: %w", err)
	}

	sealed := b.activeAEAD.Seal(nil, nonce, plaintext, nil)

	return fmt.Sprintf("%s:%s:%s",
		b.activeID,
		base64.StdEncoding.EncodeToString(nonce),
		base64.StdEncoding.EncodeToString(sealed),
	), nil
}

// Decrypt opens a blob produced by Encrypt. The blob's key_id selects the
// key, so blobs sealed by any configured (current or previous) key decrypt
// transparently.
func (b *SecretBox) Decrypt(encoded string) ([]byte, error) {
	parts := strings.Split(encoded, ":")
	if len(parts) != 3 {
		return nil, ErrInvalidBlob
	}

	id, nonceB64, sealedB64 := parts[0], parts[1], parts[2]
	key, ok := b.keys[id]
	if !ok {
		return nil, ErrKeyNotFound
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceB64)
	if err != nil {
		return nil, ErrInvalidBlob
	}
	sealed, err := base64.StdEncoding.DecodeString(sealedB64)
	if err != nil {
		return nil, ErrInvalidBlob
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("secretbox: key %q: %w", id, err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("secretbox: key %q: %w", id, err)
	}

	plaintext, err := aead.Open(nil, nonce, sealed, nil)
	if err != nil {
		return nil, ErrAuthentication
	}

	return plaintext, nil
}

// parseEntry validates one "key_id:base64" spec entry. The key id is limited
// to [A-Za-z0-9_-] so the stored blob's colon-separated format stays unambiguous.
func parseEntry(entry string) (string, []byte, error) {
	id, keyB64, found := strings.Cut(strings.TrimSpace(entry), ":")
	if !found || id == "" || keyB64 == "" {
		return "", nil, fmt.Errorf("%w: entry %q must be key_id:base64", ErrInvalidSpec, entry)
	}
	if len(id) > maxKeyID {
		return "", nil, fmt.Errorf("%w: key id %q longer than %d chars", ErrInvalidSpec, id, maxKeyID)
	}
	for _, r := range id {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-') {
			return "", nil, fmt.Errorf("%w: key id %q may only contain [A-Za-z0-9_-]", ErrInvalidSpec, id)
		}
	}

	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return "", nil, fmt.Errorf("%w: key %q is not valid base64", ErrInvalidSpec, id)
	}
	if len(key) != keyLen {
		return "", nil, fmt.Errorf("%w: key %q must decode to %d bytes, got %d", ErrInvalidSpec, id, keyLen, len(key))
	}

	return id, key, nil
}
