package provideroauth

import (
	"strings"
	"testing"
	"time"
)

func TestSessionIssueVerifyRoundTrip(t *testing.T) {
	s := NewSession("test-secret")

	state, err := s.Issue("ws-1", "user-1", "google_drive")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}
	if state == "" {
		t.Fatal("Issue() returned empty state")
	}

	payload, err := s.Verify(state, "google_drive")
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if payload.WorkspaceID != "ws-1" || payload.UserID != "user-1" || payload.Provider != "google_drive" {
		t.Fatalf("payload mismatch: %+v", payload)
	}
}

func TestSessionVerifyRejectsTamperedState(t *testing.T) {
	s := NewSession("test-secret")

	state, err := s.Issue("ws-1", "user-1", "google_drive")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	// Flip a payload byte: signature no longer matches.
	tampered := "x" + state[1:]
	if _, err := s.Verify(tampered, "google_drive"); err == nil {
		t.Fatal("Verify() accepted tampered state")
	}

	// Valid signature but wrong provider slug: cross-provider callback must
	// be rejected.
	if _, err := s.Verify(state, "dropbox"); err == nil {
		t.Fatal("Verify() accepted state issued for another provider")
	}

	// Garbage input.
	if _, err := s.Verify("not-a-state", "google_drive"); err == nil {
		t.Fatal("Verify() accepted garbage state")
	}
}

func TestSessionVerifyRejectsExpiredState(t *testing.T) {
	s := NewSession("test-secret")

	state, err := s.Issue("ws-1", "user-1", "google_drive")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	// Jump the clock past the TTL.
	s.now = func() time.Time { return time.Now().Add(DefaultStateTTL + time.Minute) }

	if _, err := s.Verify(state, "google_drive"); err != ErrExpiredState {
		t.Fatalf("Verify() error = %v, want ErrExpiredState", err)
	}
}

func TestSessionStatesAreUniquePerIssue(t *testing.T) {
	s := NewSession("test-secret")

	first, err := s.Issue("ws-1", "user-1", "dropbox")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}
	second, err := s.Issue("ws-1", "user-1", "dropbox")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	if first == second {
		t.Fatal("two Issue() calls produced identical states (nonce not random)")
	}
}

func TestSessionSecretBindsSignature(t *testing.T) {
	s1 := NewSession("secret-a")
	s2 := NewSession("secret-b")

	state, err := s1.Issue("ws-1", "user-1", "onedrive")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	if _, err := s2.Verify(state, "onedrive"); err == nil {
		t.Fatal("Verify() accepted a state signed with a different secret")
	}
}

func TestExternalAccountIDPrefixesProvider(t *testing.T) {
	got := ExternalAccountID("dropbox", "dbid:ABC123")
	if got != "dropbox:dbid:ABC123" {
		t.Fatalf("ExternalAccountID() = %q", got)
	}
	if !strings.HasPrefix(got, "dropbox:") {
		t.Fatal("external account id must carry the provider prefix")
	}
}
