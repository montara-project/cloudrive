package connectors

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestToSMBPath(t *testing.T) {
	cases := []struct {
		name    string
		key     string
		want    string
		wantErr bool
	}{
		{"plain file", "report.txt", `report.txt`, false},
		{"nested", "a/b/c.txt", `a\b\c.txt`, false},
		{"leading slash", "/etc/passwd", "", true},
		{"trailing slash", "folder/", "", true},
		{"empty", "", "", true},
		{"dot segment", "a/./b", "", true},
		{"parent traversal", "a/../b", "", true},
		{"escaped parent traversal", `a\..\b`, "", true},
		{"double slash", "a//b", "", true},
		{"backslash smuggle", `a\..\..\windows`, "", true},
		{"drive colon", "C:/Windows", "", true},
		{"ads colon", "file.txt:hidden", "", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := toSMBPath(tc.key)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for key %q, got path %q", tc.key, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for key %q: %v", tc.key, err)
			}
			if got != tc.want {
				t.Fatalf("key %q: got path %q, want %q", tc.key, got, tc.want)
			}
		})
	}
}

func TestSMBConnectorFullKeyPrefixes(t *testing.T) {
	c := &smbConnector{rootPrefix: "media/music"}

	key, err := c.fullKey("album/track.flac")
	if err != nil {
		t.Fatal(err)
	}
	if key != `media\music\album\track.flac` {
		t.Fatalf("got %q", key)
	}

	key, err = c.fullKey("top.txt")
	if err != nil {
		t.Fatal(err)
	}
	if key != `media\music\top.txt` {
		t.Fatalf("got %q", key)
	}
}

func TestSMBConnectorFullDir(t *testing.T) {
	cases := []struct {
		rootPrefix string
		prefix     string
		want       string
	}{
		{"", "", "."},
		{"", "a/b", `a\b`},
		{"media", "", `media`},
		{"media", "a/b", `media\a\b`},
		{"media", "a/b/", `media\a\b`},
	}

	for _, tc := range cases {
		c := &smbConnector{rootPrefix: tc.rootPrefix}
		got, err := c.fullDir(tc.prefix)
		if err != nil {
			t.Fatalf("rootPrefix %q prefix %q: %v", tc.rootPrefix, tc.prefix, err)
		}
		if got != tc.want {
			t.Fatalf("rootPrefix %q prefix %q: got %q, want %q", tc.rootPrefix, tc.prefix, got, tc.want)
		}
	}
}

func TestSMBListOffsetTokens(t *testing.T) {
	offset, err := decodeSMBListOffset(encodeSMBListOffset(42))
	if err != nil {
		t.Fatal(err)
	}
	if offset != 42 {
		t.Fatalf("got offset %d, want 42", offset)
	}

	for _, token := range []string{"garbage", "aGVsbG8=", ".."} {
		if _, err := decodeSMBListOffset(token); err == nil {
			t.Fatalf("expected token %q to be rejected", token)
		}
	}
}

func TestNewSMBConnectorCredentials(t *testing.T) {
	account := func(settings string) AccountInput {
		input := AccountInput{ID: uuid.Must(uuid.NewV7())}
		if settings != "" {
			input.Settings = []byte(settings)
		}
		return input
	}

	// Missing host or share fails closed.
	for _, creds := range []Credentials{
		{"share": "media"},
		{"host": "nas.local"},
		{},
	} {
		if _, err := newSMBConnector(account(""), creds, ""); err == nil {
			t.Fatalf("expected credentials %v to be rejected", creds)
		}
	}

	// Share names cannot smuggle separators.
	for _, share := range []string{`a\b`, "a/b"} {
		creds := Credentials{"host": "nas.local", "share": share}
		if _, err := newSMBConnector(account(""), creds, ""); err == nil {
			t.Fatalf("expected share %q to be rejected", share)
		}
	}

	// Defaults and settings overrides.
	c, err := newSMBConnector(account(`{"share": "photos", "root_prefix": "/media/"}`), Credentials{
		"host":     "nas.local",
		"share":    "media",
		"username": "backup",
		"password": "s3cret",
		"domain":   "WORKGROUP",
	}, "/tmp/staging")
	if err != nil {
		t.Fatal(err)
	}
	if c.port != "445" {
		t.Fatalf("default port: got %q", c.port)
	}
	if c.share != "photos" {
		t.Fatalf("settings share override: got %q", c.share)
	}
	if c.rootPrefix != "media" {
		t.Fatalf("root prefix trimmed: got %q", c.rootPrefix)
	}
	if c.username != "backup" || c.password != "s3cret" || c.domain != "WORKGROUP" {
		t.Fatalf("credentials not carried: %+v", c)
	}
	if !strings.HasSuffix(c.stagingDir, "/tmp/staging") {
		t.Fatalf("staging dir: got %q", c.stagingDir)
	}

	// A settings share override with separators is rejected too.
	if _, err := newSMBConnector(account(`{"share": "a/b"}`), Credentials{"host": "nas.local", "share": "media"}, ""); err == nil {
		t.Fatal("expected settings share override with a separator to be rejected")
	}
}
