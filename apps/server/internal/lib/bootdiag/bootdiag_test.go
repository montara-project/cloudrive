package bootdiag

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/lib/pq"
)

func fixtureReport(rootCause string, prob map[string]float64, confidence float64, noul float64) string {
	out, _ := json.Marshal(response{
		Answers: map[string]answer{
			"root_cause": {
				Type:          "choice",
				Choice:        rootCause,
				Probabilities: prob,
				Confidence:    confidence,
			},
			"migration_will_fix_boot": {
				Type: "noul",
				Noul: noul,
			},
		},
		Usage: struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		}{InputTokens: 312, OutputTokens: 48},
	})
	return string(out)
}

// missingMigrationsFacts mirrors the classic container first-run failure:
// relation "users" does not exist on a reachable, freshly created database.
func missingMigrationsFacts() Facts {
	return Facts{
		ErrorMessage:           `pq: relation "users" does not exist`,
		PostgresErrorCode:      "42P01",
		RunningInContainer:     true,
		DatabaseReachable:      true,
		AppTablesPresent:       false,
		MigrateBinaryAvailable: true,
		SuperUserSeeding:       true,
		Environment:            "production",
	}
}

func TestDiagnoseRoundTrip(t *testing.T) {
	var gotRequest request
	var gotAuth string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/systemone" {
			t.Errorf("path = %q, want /v1/systemone", r.URL.Path)
		}
		gotAuth = r.Header.Get("Authorization")
		if gotAuth != "Bearer test-key" {
			t.Errorf("Authorization = %q", gotAuth)
		}

		if err := json.NewDecoder(r.Body).Decode(&gotRequest); err != nil {
			t.Errorf("decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(fixtureReport(CauseMissingMigrations,
			map[string]float64{CauseMissingMigrations: 0.92, CauseOther: 0.08}, 0.88, 0.95)))
	}))
	defer server.Close()

	client := NewClient("test-key")
	client.BaseURL = server.URL

	report, err := client.Diagnose(context.Background(), missingMigrationsFacts())
	if err != nil {
		t.Fatalf("Diagnose: %v", err)
	}

	if gotAuth != "Bearer test-key" {
		t.Fatalf("auth header not seen by server")
	}
	if gotRequest.Model != "jev-latest" {
		t.Errorf("model = %q, want jev-latest", gotRequest.Model)
	}
	if gotRequest.State.ErrorMessage != missingMigrationsFacts().ErrorMessage {
		t.Errorf("state error_message = %q", gotRequest.State.ErrorMessage)
	}
	if gotRequest.State.PostgresErrorCode != "42P01" {
		t.Errorf("state postgres_error_code = %q", gotRequest.State.PostgresErrorCode)
	}
	if q := gotRequest.Questions["root_cause"]; q.Type != "choice" {
		t.Errorf("root_cause type = %q, want choice", q.Type)
	} else if criteria, ok := q.Criteria.(map[string]any); !ok || len(criteria) != 6 {
		t.Errorf("root_cause criteria options = %v, want 6 options", q.Criteria)
	}
	if q := gotRequest.Questions["migration_will_fix_boot"]; q.Type != "noul" {
		t.Errorf("migration_will_fix_boot type = %q, want noul", q.Type)
	}

	if report.RootCause != CauseMissingMigrations {
		t.Errorf("RootCause = %q", report.RootCause)
	}
	if report.Probabilities[CauseMissingMigrations] != 0.92 {
		t.Errorf("Probabilities[missing_migrations] = %v", report.Probabilities[CauseMissingMigrations])
	}
	if report.Confidence != 0.88 {
		t.Errorf("Confidence = %v", report.Confidence)
	}
	if report.MigrationWillFix != 0.95 {
		t.Errorf("MigrationWillFix = %v", report.MigrationWillFix)
	}
	if report.InputTokens != 312 {
		t.Errorf("InputTokens = %d", report.InputTokens)
	}
}

func TestDiagnoseRetriesOn429(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = w.Write([]byte(fixtureReport(CauseMissingMigrations,
			map[string]float64{CauseMissingMigrations: 0.9}, 0.9, 0.9)))
	}))
	defer server.Close()

	client := NewClient("test-key")
	client.BaseURL = server.URL

	report, err := client.Diagnose(context.Background(), missingMigrationsFacts())
	if err != nil {
		t.Fatalf("Diagnose: %v", err)
	}
	if attempts != 2 {
		t.Errorf("attempts = %d, want 2", attempts)
	}
	if report.RootCause != CauseMissingMigrations {
		t.Errorf("RootCause = %q", report.RootCause)
	}
}

func TestDiagnoseGivesUpAfterRetries(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(529)
	}))
	defer server.Close()

	client := NewClient("test-key")
	client.BaseURL = server.URL

	if _, err := client.Diagnose(context.Background(), missingMigrationsFacts()); err == nil {
		t.Fatal("expected error after exhausted retries")
	}
	if attempts != maxRetries+1 {
		t.Errorf("attempts = %d, want %d", attempts, maxRetries+1)
	}
}

func TestDiagnoseAuthErrorNoRetry(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	client := NewClient("bad-key")
	client.BaseURL = server.URL

	if _, err := client.Diagnose(context.Background(), missingMigrationsFacts()); err == nil {
		t.Fatal("expected error for 401")
	}
	if attempts != 1 {
		t.Errorf("attempts = %d, want 1 (no retry on auth failures)", attempts)
	}
}

func TestDiagnoseWithoutAPIKey(t *testing.T) {
	client := NewClient("")
	if _, err := client.Diagnose(context.Background(), missingMigrationsFacts()); !errors.Is(err, ErrNoAPIKey) {
		t.Errorf("err = %v, want ErrNoAPIKey", err)
	}
}

func TestCollectFactsCapturesPostgresCode(t *testing.T) {
	bootErr := &pq.Error{Code: "42P01", Message: `relation "users" does not exist`}

	facts := CollectFacts(context.Background(), nil, bootErr, true, "/app/migrate", "production")

	if facts.PostgresErrorCode != "42P01" {
		t.Errorf("PostgresErrorCode = %q", facts.PostgresErrorCode)
	}
	if !facts.RunningInContainer {
		t.Error("RunningInContainer = false, want true")
	}
	if !facts.MigrateBinaryAvailable {
		t.Error("MigrateBinaryAvailable = false, want true")
	}
	if facts.DatabaseReachable {
		t.Error("DatabaseReachable = true without a database handle")
	}
}

func TestDecidePolicy(t *testing.T) {
	high := &Report{
		RootCause:        CauseMissingMigrations,
		Probabilities:    map[string]float64{CauseMissingMigrations: 0.92, CauseOther: 0.08},
		Confidence:       0.88,
		MigrationWillFix: 0.95,
	}

	if action, _ := high.Decide(DecideOptions{MigrateOnBoot: true, MigrateBinaryAvailable: true}); action != ActionRunMigrations {
		t.Errorf("high-probability missing_migrations with MIGRATE_ON_BOOT: action = %s, want run_migrations", action)
	}
	if action, msg := high.Decide(DecideOptions{}); action != ActionFixConfig {
		t.Errorf("missing_migrations without MIGRATE_ON_BOOT: action = %s, want fix_config", action)
	} else if msg == "" {
		t.Error("fix_config must carry a remediation message")
	}

	unreachable := &Report{
		RootCause:     CauseDBUnreachable,
		Probabilities: map[string]float64{CauseDBUnreachable: 0.8},
		Confidence:    0.8,
	}
	if action, _ := unreachable.Decide(DecideOptions{MigrateOnBoot: true, MigrateBinaryAvailable: true}); action != ActionFixConfig {
		t.Errorf("db_unreachable: action = %s, want fix_config (migrations never fix a wrong host)", action)
	}

	ambiguous := &Report{
		RootCause:     CauseOther,
		Probabilities: map[string]float64{CauseOther: 0.34, CauseApplicationBug: 0.33, CauseDBNotReady: 0.33},
		Confidence:    0.35,
	}
	if action, _ := ambiguous.Decide(DecideOptions{}); action != ActionEscalate {
		t.Errorf("low-confidence split: action = %s, want escalate", action)
	}

	// A missing_migrations verdict that is not backed by probability or
	// confidence must not reach the fix_config shortcut either.
	weak := &Report{
		RootCause:        CauseMissingMigrations,
		Probabilities:    map[string]float64{CauseMissingMigrations: 0.40, CauseDBNotReady: 0.60},
		Confidence:       0.30,
		MigrationWillFix: 0.10,
	}
	if action, _ := weak.Decide(DecideOptions{MigrateOnBoot: true, MigrateBinaryAvailable: true}); action != ActionEscalate {
		t.Errorf("weak missing_migrations: action = %s, want escalate", action)
	}
}
