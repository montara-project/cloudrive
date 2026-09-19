// Package bootdiag diagnoses application boot failures with TypeSafe's
// System One model (Jev).
//
// The first boot of apps/server commonly fails on a fresh database (e.g.
// `relation "users" does not exist` before migrations run) or, inside a
// container, on network/topology problems (unreachable DB host, database
// still starting). This package collects structured facts about the failed
// boot, asks Jev for typed judgments — the most likely root cause and whether
// running migrations would fix the boot — and lets deterministic policy in
// the caller decide the action.
//
// Code owns the execution and thresholds (see Decide); the model supplies the
// semantic classification. Without TYPESAFE_API_KEY the caller degrades to
// deterministic remediation messages only.
package bootdiag

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/lib/pq"
)

const (
	defaultBaseURL = "https://api.typesafe.ai"
	model          = "jev-latest"

	maxRetries   = 2 // extra attempts after the first call
	retryDelay   = 250 * time.Millisecond
	probeTimeout = 2 * time.Second
)

// ErrNoAPIKey is returned when diagnosis is requested but no API key is
// configured; callers should degrade to deterministic remediation.
var ErrNoAPIKey = errors.New("bootdiag: TYPESAFE_API_KEY is not configured")

// Facts is the structured state Jev evaluates. Named JSON fields keep the
// context readable for the model.
type Facts struct {
	ErrorMessage           string `json:"error_message"`
	PostgresErrorCode      string `json:"postgres_error_code,omitempty"`
	RunningInContainer     bool   `json:"running_in_container"`
	DatabaseReachable      bool   `json:"database_reachable"`
	AppTablesPresent       bool   `json:"app_tables_present"`
	MigrateBinaryAvailable bool   `json:"migrate_binary_available"`
	SuperUserSeeding       bool   `json:"super_user_seeding"`
	Environment            string `json:"environment"`
}

// Root cause categories returned in the root_cause Choice answer.
const (
	CauseMissingMigrations = "missing_migrations"
	CauseDBUnreachable     = "db_unreachable"
	CauseDBAuthFailed      = "db_auth_failed"
	CauseDBNotReady        = "db_not_ready"
	CauseApplicationBug    = "application_bug"
	CauseOther             = "other"
)

// Action is what deterministic policy decided from the diagnosis.
type Action string

const (
	ActionRunMigrations Action = "run_migrations"
	ActionFixConfig     Action = "fix_config"
	ActionEscalate      Action = "escalate"
)

// Report is the typed diagnosis.
type Report struct {
	RootCause        string             `json:"root_cause"`
	Probabilities    map[string]float64 `json:"probabilities"`
	Confidence       float64            `json:"confidence"`
	MigrationWillFix float64            `json:"migration_will_fix"`
	InputTokens      int                `json:"input_tokens"`
	OutputTokens     int                `json:"output_tokens"`
}

// DecideOptions carries the caller's policy inputs.
type DecideOptions struct {
	MigrateOnBoot          bool
	MigrateBinaryAvailable bool
}

// Decide maps the diagnosis onto an action with fixed thresholds. The model
// never executes anything: high-probability missing_migrations plus an
// available migration binary plus an explicit MIGRATE_ON_BOOT opt-in is the
// only path to running migrations; low confidence escalates to a human.
func (r *Report) Decide(opts DecideOptions) (Action, string) {
	probMissing := r.Probabilities[CauseMissingMigrations]

	if r.RootCause == CauseMissingMigrations && probMissing >= 0.70 &&
		r.MigrationWillFix >= 0.70 && opts.MigrateOnBoot && opts.MigrateBinaryAvailable {
		return ActionRunMigrations,
			"Tables appear to be missing and MIGRATE_ON_BOOT is enabled — applying migrations before the next boot attempt."
	}

	if r.RootCause == CauseMissingMigrations && (probMissing >= 0.70 || r.Confidence >= 0.70) {
		return ActionFixConfig,
			"Application tables are missing: run `make db/migrations/up` against this database, or set MIGRATE_ON_BOOT=true for container first-run recovery."
	}

	if r.RootCause == CauseDBUnreachable || r.RootCause == CauseDBAuthFailed || r.RootCause == CauseDBNotReady {
		return ActionFixConfig,
			"Fix the database connection settings (DB_DSN host/credentials) for this deployment target."
	}

	if r.Confidence < 0.40 {
		return ActionEscalate,
			"Boot failure could not be classified with confidence — inspect the database logs (the STATEMENT line next to the error) and the full facts above."
	}

	return ActionFixConfig,
		"Review the failure with the classified root cause above before restarting."
}

// --- client ---------------------------------------------------------------

// Client calls the TypeSafe System One endpoint.
type Client struct {
	APIKey  string
	BaseURL string
	HTTP    *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		APIKey:  apiKey,
		BaseURL: defaultBaseURL,
		HTTP:    &http.Client{Timeout: 15 * time.Second},
	}
}

type request struct {
	Model     string              `json:"model"`
	State     Facts               `json:"state"`
	Questions map[string]question `json:"questions"`
}

type question struct {
	Type         string `json:"type"`
	Instructions string `json:"instructions"`
	Criteria     any    `json:"criteria"`
}

type answer struct {
	Type          string             `json:"type"`
	Noul          float64            `json:"noul"`
	Choice        string             `json:"choice"`
	Probabilities map[string]float64 `json:"probabilities"`
	Confidence    float64            `json:"confidence"`
}

type response struct {
	Answers map[string]answer `json:"answers"`
	Usage   struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// Diagnose asks one batched request with both judgments; they are independent
// questions over the same state, so they run in parallel server-side.
func (c *Client) Diagnose(ctx context.Context, facts Facts) (*Report, error) {
	if c.APIKey == "" {
		return nil, ErrNoAPIKey
	}

	body := request{
		Model: model,
		State: facts,
		Questions: map[string]question{
			"root_cause": {
				Type:         "choice",
				Instructions: "The API server failed during a boot attempt on a fresh deployment (often a container's first run) while preparing the application database. Which root cause best explains the failure?",
				Criteria: map[string]string{
					CauseMissingMigrations: "The database is reachable and authenticates, but application tables were never created: errors like relation \"users\" does not exist (SQLSTATE 42P01) because SQL migrations have not run on this database yet.",
					CauseDBUnreachable:     "No TCP connection to the database host could be established: connection refused, DNS resolution failure, or timeout — e.g. a DSN pointing to localhost from inside a container network.",
					CauseDBAuthFailed:      "The database was reached but rejected access: password authentication failed or the database role does not exist.",
					CauseDBNotReady:        "The database accepted the connection but is still starting up or temporarily unavailable and refused queries.",
					CauseApplicationBug:    "The failure looks like an application defect or missing configuration (invalid flag, nil reference, required setting absent), not a database state problem.",
					CauseOther:             "None of the listed causes fit the evidence.",
				},
			},
			"migration_will_fix_boot": {
				Type:         "noul",
				Instructions: "Running the application's SQL migration tool against this database now would fix this boot failure so the server can start successfully.",
				Criteria: map[string]string{
					"true":  "The failure is caused by application tables not existing yet (or being outdated), with no other blocking problem evident.",
					"false": "The failure has a different root cause — unreachable host, wrong credentials, or an application bug — that migrations would not fix.",
				},
			},
		},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("bootdiag: encoding request: %w", err)
	}

	resp, err := c.post(ctx, payload)
	if err != nil {
		return nil, err
	}

	return buildReport(resp), nil
}

// post sends the request, retrying 429/529 with a short backoff per the
// API's rate-limit guidance.
func (c *Client) post(ctx context.Context, payload []byte) (*response, error) {
	url := c.BaseURL + "/v1/systemone"

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(retryDelay * time.Duration(attempt))
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
		if err != nil {
			return nil, fmt.Errorf("bootdiag: building request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
		req.Header.Set("Content-Type", "application/json")

		httpResp, err := c.HTTP.Do(req)
		if err != nil {
			return nil, fmt.Errorf("bootdiag: calling %s: %w", url, err)
		}

		raw, err := io.ReadAll(httpResp.Body)
		_ = httpResp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("bootdiag: reading response: %w", err)
		}

		switch httpResp.StatusCode {
		case http.StatusOK:
			var out response
			if err := json.Unmarshal(raw, &out); err != nil {
				return nil, fmt.Errorf("bootdiag: decoding response: %w", err)
			}
			return &out, nil
		case http.StatusTooManyRequests, 529:
			lastErr = fmt.Errorf("bootdiag: type safe api %s (attempt %d)", httpResp.Status, attempt+1)
			continue
		default:
			return nil, fmt.Errorf("bootdiag: type safe api %s: %s", httpResp.Status, truncate(raw, 256))
		}
	}

	return nil, lastErr
}

func buildReport(resp *response) *Report {
	report := &Report{
		Probabilities: map[string]float64{},
		InputTokens:   resp.Usage.InputTokens,
		OutputTokens:  resp.Usage.OutputTokens,
	}

	if a, ok := resp.Answers["root_cause"]; ok {
		report.RootCause = a.Choice
		report.Probabilities = a.Probabilities
		report.Confidence = a.Confidence
	}
	if a, ok := resp.Answers["migration_will_fix_boot"]; ok {
		report.MigrationWillFix = a.Noul
	}

	return report
}

// --- fact collection ------------------------------------------------------

// CollectFacts gathers best-effort state about the failed boot. Database
// probes are capped at probeTimeout so diagnosis never hangs the shutdown
// path; unreachable databases simply report reachable=false.
func CollectFacts(ctx context.Context, db *sql.DB, bootErr error, runningInContainer bool, migrateBinary string, environment string) Facts {
	facts := Facts{
		ErrorMessage:           bootErr.Error(),
		RunningInContainer:     runningInContainer,
		MigrateBinaryAvailable: migrateBinary != "",
		SuperUserSeeding:       true,
		Environment:            environment,
	}

	var pqErr *pq.Error
	if errors.As(bootErr, &pqErr) {
		facts.PostgresErrorCode = string(pqErr.Code)
	}

	if db == nil {
		return facts
	}

	probeCtx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()

	if err := db.PingContext(probeCtx); err != nil {
		return facts
	}
	facts.DatabaseReachable = true

	var count int
	err := db.QueryRowContext(probeCtx,
		`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'`,
	).Scan(&count)
	if err == nil {
		facts.AppTablesPresent = count > 0
	}

	return facts
}

func truncate(b []byte, n int) string {
	if len(b) <= n {
		return string(b)
	}
	return string(b[:n]) + "..."
}
