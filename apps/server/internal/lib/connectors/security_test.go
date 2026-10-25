package connectors

import (
	"strings"
	"testing"
)

func TestGraphURLAllowed(t *testing.T) {
	cases := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"graph api", "https://graph.microsoft.com/v1.0/drives/x/items/y", false},
		{"graph upload session", "https://graph.microsoft.com/v1.0/drives/x/uploadSession?guid=deadbeef", false},
		{"subdomain", "https://foo.microsoft.com/path", false},
		{"sharepoint", "https://contoso.sharepoint.com/personal/x", false},
		{"attacker host", "https://evil.example.com/callback", true},
		{"lookalike suffix", "https://notmicrosoft.com/path", true},
		{"suffix splice", "https://graph.microsoft.com.evil.example.com/x", true},
		{"plain http", "http://graph.microsoft.com/v1.0", true},
		{"garbage", "://not a url", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := graphURLAllowed(tc.url)
			if tc.wantErr && err == nil {
				t.Fatalf("expected error for %q", tc.url)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error for %q: %v", tc.url, err)
			}
		})
	}
}

func TestDecodeGraphContinuationRejectsForeignHost(t *testing.T) {
	token := encodeGraphContinuation("https://evil.example.com/steal")
	if _, err := decodeGraphContinuation(token); err == nil {
		t.Fatal("expected foreign-host continuation token to be rejected")
	}
}

func TestGdriveStagingDirRejectsTraversal(t *testing.T) {
	c := &gdriveConnector{}

	for _, id := range []string{"../../etc", "../home/user/.ssh", "a/b/c", "", strings.Repeat("f", 32) + "/x", strings.ToUpper(strings.Repeat("a", 32))} {
		if _, err := c.stagingDir(id); err == nil {
			t.Fatalf("expected uploadId %q to be rejected", id)
		}
	}
}

func TestGdriveStagingDirAcceptsIssuedID(t *testing.T) {
	c := &gdriveConnector{}

	id, err := newUploadID()
	if err != nil {
		t.Fatal(err)
	}
	dir, err := c.stagingDir(id)
	if err != nil {
		t.Fatalf("issued upload id rejected: %v", err)
	}
	if !strings.Contains(dir, id) {
		t.Fatalf("staging dir %q does not contain upload id %q", dir, id)
	}
}
