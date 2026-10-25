# ISSUES — Security & Code-Quality Audit

Generated: 2026-10-25 · Audited commit: `fa7b836` (dev) · Scope: `apps/server`, `apps/web`, `apps/docs`, deploy config.

Method: three parallel source-review passes (auth/authz/tenant-isolation; injection/S3-gateway/vault/OAuth; client/config/supply-chain), every High finding re-verified by hand against the cited source, plus a ponytail over-engineering pass. No live probing; all evidence is from source.

**Remediation pass (2026-10-25):** SEC-001, 002, 003, 004, 006, 007, 008, 009, 010, 012, 013, 014, 016, 017, 020, 022 are **fixed** (source changes, build + `go vet` + `-race` tests green); the chunked-transfer comment (SEC-015) is corrected, the :8081 rate limiter half of SEC-019 is in, and functional bugs 1, 2, and 4 are fixed. **Deferred with reasons:** SEC-005 (real fix restructures token storage into Authula-issued HttpOnly cookies — CSP/HSTS now compensating), SEC-011 (product decision on consent), SEC-015 chunk-crypto implementation, SEC-018 (needs a vault re-encryption migration), SEC-019 per-key scoping, SEC-021 (deployment fact), and the large lean deletions (dead repos, Lexical stack) which deserve a dedicated cleanup pass.

Severity anchors: **critical** unauthenticated RCE/full datastore/takeover · **high** an actor fully defeats an explicit control with real consequences · **medium** real boundary violation, limited blast radius or uncommon preconditions · **low** weakens a control or minimal gain · **informational** confirmed, minimal impact.

No critical findings. What follows is sorted by security level.

---

## High

### SEC-001 ·

**Status: ✅ fixed 2026-10-25.** OneDrive connector: SSRF with bearer-token exfiltration via client-controlled continuation URLs

- **Location:** `apps/server/internal/lib/connectors/onedrive.go:484-494` (`decodeGraphContinuation`), `:552-588` (`UploadPart`), `:610-630` (`AbortMultipartUpload`), `:426-447` (`ListObjects` continuation); entry point `apps/server/internal/handlers/s3gateway/handler.go:456` (`uploadID := c.Query("uploadId")`) and `:233` (continuation token).
- **Trust boundary:** any SigV4-authenticated gateway client → `uploadId` / `continuation-token` query params → the server performs `http.NewRequestWithContext(..., uploadURL, ...)` with the **connected account's Microsoft Graph bearer token attached** (the oauth2 transport, `onedrive.go:115-117`) to a URL the client fully controls.
- **Evidence:** the "token" is plain base64 of a URL with zero validation:
  ```go
  func decodeGraphContinuation(token string) (string, error) {
      raw, err := base64.RawURLEncoding.DecodeString(token)
      ...
  }
  ```
  `UploadPart` then does `PUT <decoded-url>` with the request body; `AbortMultipartUpload` does `DELETE`; `ListObjects` continuation does `GET` and parses the response. The gateway never checks that an `uploadId` was server-issued.
- **Impact:** a gateway key holder (workspace admin-issued) can make the server send the Microsoft access token — and arbitrary attacker bytes — to any host they run. The token grants read/write of the connected OneDrive account. `PUT` also uploads arbitrary content as the user.
- **Smallest fix:** after `decodeGraphContinuation`, validate the decoded URL's scheme+host against `graph.microsoft.com` (and the upload-session host `*.microsoft.com`); or store Graph-issued upload URLs server-side keyed by an opaque random ID (the pattern `gdrive.go` already uses for staging IDs). Same gate covers `ListObjects` continuation tokens.
- **Note:** the Dropbox connector is *not* affected — its session ids/cursors are opaque strings sent to fixed endpoints.

### SEC-002 ·

**Status: ✅ fixed 2026-10-25.** Google Drive multipart staging: path traversal → arbitrary file write and `RemoveAll`

- **Location:** `apps/server/internal/lib/connectors/gdrive.go:430-436` (`stagingDir`), `:459-477` (`UploadPart` write), `:528` + `:532-534` (`os.RemoveAll` on complete/abort); entry point `handler.go:456` (raw `uploadId` from query).
- **Trust boundary:** any SigV4 gateway client → `uploadId` query param → `filepath.Join(base, "cloudrive-gdrive-multipart", uploadID)` — `filepath.Join` cleans `../`, so `uploadId=..%2F..%2F...` escapes the staging root.
- **Evidence:** `stagingDir` joins the client string into a filesystem path with no validation; `UploadPart` writes attacker-controlled bytes to `filepath.Join(dir, "part-%05d")` (`O_CREATE|O_TRUNC`); `AbortMultipartUpload` is literally `os.RemoveAll(c.stagingDir(uploadID))`. `CreateMultipartUpload` mints a random hex ID but nothing verifies a later `uploadId` was issued.
- **Impact:** arbitrary file write (content controlled, filename constrained to `part-NNNNN`) and arbitrary directory deletion, within the server process's permissions (non-root `cloudrive` user in the container limits blast radius; the staging default is `os.TempDir()`).
- **Smallest fix:** validate `uploadID` against the server-issued format (`^[0-9a-f]{32}$`, see `newUploadID()`) in `stagingDir` — one regex rejects every traversal.

### SEC-003 ·

**Status: ✅ fixed 2026-10-25.** `SUPER_USER` seeding promotes a pre-registered (squatting) account to verified admin and keeps its password

- **Location:** `apps/server/cmd/api/superuser.go:62-101`; open sign-up `apps/server/cmd/api/authula.go:146-155` (`AutoSignIn: true`); `.env.example:14` (`SUPER_USER=email:password`).
- **Trust boundary:** anonymous attacker pre-registers `SUPER_USER`'s email via open sign-up → later, the operator boots once with `SUPER_USER=<that-email>:<password>` → the seeder's existing-user branch promotes the row (`EmailVerified=true`, `Metadata["role"]="admin"`) and only sets a password **when the account has no credential** (`superuser.go:90` — "The password is never reset").
- **Impact:** the attacker retains their own password on a now-verified admin account. The operator's configured password is silently ignored. Realistic because sign-up is open and the format is documented in `.env.example`.
- **Smallest fix:** in the existing-user branch, always reset the email-password credential to the configured hash when `SUPER_USER` is set (or refuse to promote an account that already has a credential and log a hard error telling the operator to choose another email / delete the row first).

---

## Medium

### SEC-004 ·

**Status: ✅ fixed 2026-10-25.** Bucket `root_prefix` is documented but never enforced — mappings sharing an account share everything

- **Location:** promise `apps/server/internal/models/s3.go:28-38` (`RootPrefix`: "Objects written through the gateway to this bucket live under the prefix"); `internal/handlers/s3gateway/handler.go:145-174` (`connectorFor` passes only `{ID, Settings}` — never `bucket.RootPrefix`); `internal/lib/connectors/s3.go:97-114` (only the **account**-level `settings.root_prefix` is applied).
- **Trust boundary:** gateway client of a workspace → any bucket mapping → the entire backing account namespace. Two mappings on one storage account can read and overwrite each other's objects.
- **Impact:** the per-bucket isolation the management API advertises (and admin UIs may rely on) does not exist.
- **Smallest fix:** thread `bucket.RootPrefix` into `connectorFor` and apply it in the connector exactly like `settings.root_prefix` (prepend to key on read/write/list, reject escapes); or remove the field from the API/DB until implemented. Related: `../` key segments (`dropbox.go:96-98`, `onedrive.go:121-136`) rely on provider-side normalization — sanitize `.`/`..` segments centrally at the same time.

### SEC-005 ·

**Status: ⏸ deferred — real fix restructures refresh-token storage into Authula-issued HttpOnly cookies; CSP+HSTS (SEC-008) are the compensating controls now in place.** Auth tokens live in JavaScript-readable cookies, including a 30-day refresh token

- **Location:** `apps/web/src/lib/auth/token-storage.ts:13` (`REFRESH_TOKEN_MAX_AGE = 60*60*24*30`), `:46-51` (`document.cookie = ...` no HttpOnly), `:78-80` (full `/me` user snapshot in an `authUser` cookie); transport confirmed bearer-only in `lib/api/client-fetch.ts:28-30`.
- **Trust boundary:** any script execution on the app origin (XSS in a future dependency/extension/CDN compromise — no sink exists today) → `document.cookie` → 30-day refresh token → unlimited new sessions via `/api/v1/auth/token/refresh`.
- **Impact:** XSS becomes a long-lived full-session hijack primitive. Mitigations present: host-only cookies (no `Domain`), `SameSite=Lax`, `Secure` on https.
- **Smallest fix:** move refresh-token storage server-side (HttpOnly cookie issued by Authula) so script cannot reach it; keep only the short-lived access token in memory. Interim: drop the 30-day Max-Age, and see SEC-008 (CSP) as the compensating control.

### SEC-006 ·

**Status: ✅ fixed 2026-10-25.** Google Drive object lookup ignores the key's directory — wrong-object reads and deletes

- **Location:** `apps/server/internal/lib/connectors/gdrive.go:195-231` (`lookup` matches `name = "<baseName>" and "<rootFolder>" in parents` — key path never walked), used by `GetObject`/`StatObject`/`DeleteObject` (`:270, :302, :319`). Writes do walk the path (`ensureParent`), so objects land in nested folders that reads can no longer address correctly.
- **Trust boundary:** gateway client → key `a/report.txt` resolves to root-level `report.txt` → wrong object returned; `DeleteObject` destroys the wrong file. Confined to the mapped root folder (no cross-tenant escape), but the S3 key namespace is not honored. The in-memory path cache would mask this sometimes, but connectors are constructed per request (`registry.go:78-81`), so it is always cold.
- **Smallest fix:** make `lookup` walk the full key path like `ensureParent` does, and key the path cache per account lifetime (or drop the cache).

### SEC-007 ·

**Status: ✅ fixed 2026-10-25.** Data race: singleton handler field `providerSlug` mutated per request

- **Location:** `apps/server/internal/handlers/factory.go:34` (one shared `&storageAccountOAuthHandler{}`), `internal/handlers/storage_account_oauth.go:356` (`h.providerSlug = provider.Slug`), `:362-364` (read in `flowForAccount`, called from `Refresh`/`Quota`).
- **Trust boundary:** two concurrent authenticated requests race the field; account A's refresh token can be POSTed to provider B's token endpoint under B's client credentials (B rejects it; the token transits to a third party — the provider — not the attacker). It is also undefined behavior in Go.
- **Smallest fix:** thread the slug through as a parameter from `authorizeOAuthAccount` to `flowForAccount` (the field exists only to bridge the two methods). `go test -race` catches it once a concurrent test exists.

### SEC-008 ·

**Status: ✅ fixed 2026-10-25.** No Content-Security-Policy and no HSTS on any origin (mitigation gap for SEC-005)

- **Location:** `apps/server/cmd/api/server.go:52-56` (helmet configured only to relax COEP; fiber v3 helmet default sets no CSP, `HSTSMaxAge: 0`); `apps/web/index.html:43-55` (third-party fonts + analytics script, no CSP meta); `apps/docs/next.config.mjs` (no `headers()`).
- **Trust boundary:** not a violation by itself — this is the missing compensating control that makes SEC-005 exploitable from any single injection. Listed at medium because the pairing (JS-readable 30-day refresh token + no CSP) defines the current client-side risk.
- **Smallest fix:** add a CSP meta/header for the SPA (`default-src 'self'`; script-src `'self' https://analytics.masb0ymas.com`; style-src `'self' 'unsafe-inline' https://fonts.googleapis.com`; font-src `https://fonts.gstatic.com`), and enable HSTS once TLS termination is confirmed (see Needs-validation).

---

## Low

### SEC-009 ·

**Status: ✅ fixed 2026-10-25.** Client-controlled sign-up `metadata.role` is persisted into `users.role`

- **Location:** `plugins/email-password` request type (`Metadata map[string]any`), `internal/handlers/sign_up_handler.go:48`, `cmd/api/authula.go:294-321` (`roleFromMetadata`), `internal/models/user.go:16` (serialized in `/me`).
- **Boundary/result:** anonymous attacker → `{"metadata":{"role":"admin"}}` at sign-up → stored and echoed back by `/me`. No authorization decision reads `users.role` today (org/workspace roles live in `organization_members`), so impact is spoofed-UI/telemetry — but the same column is written `admin` by `superuser.go:74`, conflating operator intent with user input.
- **Fix:** whitelist sign-up metadata keys server-side, or stop deriving `users.role` from it.

### SEC-010 ·

**Status: ✅ fixed 2026-10-25.** Invitation tokens are serialized to every org member (and the redeem flow does not exist)

- **Location:** `internal/models/organization_invitation.go:18` (`json:"token"`), `internal/handlers/organization_invitation.go:92-126` (List = any member), `internal/repositories/organization_invitation.go:58-61` (`GetByToken` has zero callers — no accept endpoint anywhere).
- **Boundary/result:** inert today (tokens grant nothing), but the moment redemption lands, every member can read every pending invite secret and self-redeem an admin-role invite. Functional gap: invited users can never join via API.
- **Fix:** before shipping redemption, stop returning `token` in List (creation response only) and scope List to admins; then implement the accept endpoint.

### SEC-011 ·

**Status: ⏸ deferred — product decision — admin-consent enrollment vs invitation-consent; needs an owner call before code changes.** Org/workspace admins can attach arbitrary existing users without consent; members cannot leave

- **Location:** `internal/handlers/organization_member.go:61-113` (Add: no invitation check), `internal/handlers/workspace_member.go:91-141`; removal requires owner/admin.
- **Boundary/result:** requires admin privilege (defeats the invitation flow's purpose); cross-tenant reach is blocked by composite FKs. Product decision needed: consent or not; plus a self-serve leave endpoint.
- **Fix:** require a pending invitation for Add, and allow self-removal.

### SEC-012 ·

**Status: ✅ fixed 2026-10-25.** Storage-provider OAuth connect state is replayable within its 10-minute TTL

- **Location:** `internal/lib/provideroauth/session.go:60-121` (HMAC over `{workspace_id, user_id, provider, nonce, exp}`; nonce never recorded), `internal/handlers/storage_account_oauth.go:83-144` (callback never re-checks current membership).
- **Boundary/result:** a holder of a valid state (needs an admin to have issued it; leaks via logs/Referer) plus their own provider code can connect their account into the workspace up to 10 minutes later, even if their membership was revoked in between. Replay is idempotent (same `external_account_id` upsert), limiting impact.
- **Fix:** record the nonce (single-use) and re-verify membership in the callback.

### SEC-013 ·

**Status: ✅ fixed 2026-10-25.** `CORS_ALLOWED_ORIGINS` is passed to Authula as one raw comma-joined string

- **Location:** `cmd/api/authula.go:104-105` (`TrustedOrigins: []string{cfg.App.CORSAllowedOrigins}`) vs. fiber CORS which splits at `server.go:62`.
- **Boundary/result:** fail-closed functional bug: with multi-origin config (exactly what `.env.example` shows), Authula's magic-link/verify origin checks never match → magic-link sign-in breaks. Also the `*` default + `AllowCredentials` panics fiber CORS at boot (fail-closed, availability foot-gun).
- **Fix:** split on comma before handing to Authula; make the default explicit (require configuration) instead of `*`.

### SEC-014 ·

**Status: ✅ fixed 2026-10-25.** Auth brute-force budget is only the global 100 req/min/IP limiter

- **Location:** `cmd/api/server.go:79-95`; Authula has no lockout/throttle (verified v1.46.0) and none is layered for `/api/v1/auth/*`.
- **Boundary/result:** ~6k password/magic-link guesses per hour per IP (no proxy-trust bypass found — `TrustProxy` off by default). Standard for a pre-launch app; worth per-credential throttling before public launch.
- **Fix:** a small rate-limit middleware keyed on email+IP for the auth group.

### SEC-015 ·

**Status: ⏸ deferred — misleading comment corrected 2026-10-25; implementing chunk-signature verification is a separate crypto project.** Streaming SigV4 chunk signatures are never verified, and a comment claims they are

- **Location:** `internal/lib/sigv4/sigv4.go:189-201` (`payloadHash` returns the literal `STREAMING-AWS4-HMAC-SHA256-PAYLOAD`), `internal/handlers/s3gateway/chunked.go:25-27` (comment cites a "seed-signature check" that does not exist).
- **Boundary/result:** `aws-chunked` PUT body integrity is not enforced (seed signature is); exploitation needs a TLS-stripping MITM or buggy client. Header-signed ±15 min skew and presigned expiry are enforced.
- **Fix:** implement chunk-signature verification in `newAWSChunkedReader`, or fix the comment and document the accepted gap.

### SEC-016 ·

**Status: ✅ fixed 2026-10-25.** Google Drive queries built with Go `%q` interpolation

- **Location:** `internal/lib/connectors/gdrive.go:200, :369` (`name = %q and %q in parents`).
- **Boundary/result:** Drive's query grammar quotes strings with single quotes; `%q` emits double quotes, which Drive rejects — likely making every lookup 400 (functional bug) rather than injectable; keys containing `"` could also perturb the query if accepted. Either way the escaping is wrong for the target grammar.
- **Fix:** build the query with single-quote escaping (`strings.ReplaceAll(v, "'", "\\'")`) for both the name and the parent ID.

### SEC-017 ·

**Status: ✅ fixed 2026-10-25.** Secrets passed as CLI flags in `scripts/Makefile`

- **Location:** `apps/server/scripts/Makefile:26-49` (`--app-secret=$(APP_SECRET)` etc.).
- **Boundary/result:** visible in `ps`/`/proc` to other local processes on the host. The binary already reads the same values from env.
- **Fix:** drop the flags; rely on the env defaults.

---

## Informational

- **SEC-018 · Vault ciphertexts are not AAD-bound** — `secretbox.go:101-118` seals with `AAD = nil`; with direct DB write access a ciphertext can be transplanted between rows undetected. Bind `key_id` + row identity as AAD. (Core crypto is otherwise solid: AES-256-GCM, random nonce, key-id rotation, fail-closed boot.)
- **SEC-019 · Gateway keys are workspace-wide; `:8081` has no rate limiter** — any active key covers all objects in all of the workspace's buckets (no per-key/per-prefix scope); no limiting on the gateway listener. Tenant isolation itself is enforced per request (`handler.go:145-174`) and revocation is immediate.
- **SEC-020 · `workflow_dispatch` input interpolated into a shell command** — `.github/workflows/release-prepare.yml:73-77` `pnpm release:prepare --increment "${{ inputs.increment }}"`; exploitation requires write access (circular). Use the `env:` indirection pattern.
- **SEC-021 · Authula OAuth cookies set `Secure` only on TLS detection** — behind a terminator that omits `X-Forwarded-Proto`, the attribute is dropped (cookies are 5-minute PKCE state/verifier cookies, not sessions).
- **SEC-022 · Third-party action on a mutable tag** — `.github/workflows/react-doctor.yml:41` `millionco/react-doctor@v2` with write tokens; pin to a SHA.

## Controls verified clean (candidates checked and dropped)

- **Tenant isolation:** all 33 `/api/v1` routes carry auth middleware; every handler resolves org/workspace membership from the **session UID** (`requireOrgMember`), never trusting client org/workspace IDs; composite-FK schema makes inconsistent tenant rows unrepresentable; owner-escalation blocked by partial unique index; S3 gateway re-checks bucket↔workspace ownership on every operation; revocation immediate.
- **SQL injection:** `order_by`/`order` go through per-repository whitelists (`repositories/helpers.go:57-70`); all values parameterized; LIKE escaped; limit clamped.
- **Secrets handling:** no insecure defaults (`APP_SECRET`, `STORAGE_CREDENTIALS_KEYS` fail-closed); no secrets in repo (`.env` git-ignored, `.dockerignore`d); decrypted credentials never serialized (`json:"-"`); SQL logging never binds args.
- **OAuth flow:** state HMAC-signed, provider-bound, 10-min TTL; `redirect_uri` always config-derived (no open redirect); fixed token endpoints (no SSRF in the flow); provider errors scrubbed.
- **Client:** zero XSS sinks in `apps/web`/`apps/docs`; no tokens in localStorage; no source maps in prod; Docker images non-root; no `pull_request_target`.
- **Dependencies:** all current majors (axios 1.x, vite 8, next 16, react 19, fiber v3.5, pgx v5).

## Needs validation (deployment facts outside the repo)

1. Whether the production edge/proxy injects CSP/HSTS (if so, SEC-008 downgrades to informational).
2. Whether Dropbox/Graph normalize `..` path segments (determines SEC-004's provider-escape residual).
3. That the TLS terminator sets `X-Forwarded-Proto: https` (SEC-021).

---

## Lean pass (ponytail — over-engineering, complexity only)

**Status: ⏸ deferred** — mechanical but broad (dead repos, editor stack, config flags); deserves a dedicated cleanup pass so the security fixes stay reviewable.

- `delete:` dead repository methods with zero callers (`List/Count/GetBySlug/Restore/ForceDelete` across organization/workspace/storage/provider repos, `GetByToken`, `ListByUser` ×2). Replacement: nothing. [apps/server/internal/repositories/]
- `delete:` `escapeLikePattern` + the `whereBuilder` machinery — only consumer is a dead repo method. Replacement: nothing. [apps/server/internal/repositories/helpers.go:44-106]
- `delete:` `decodeDropboxCursor` — never called; its call site hand-rolled a broken equivalent instead (see functional bugs). Replacement: nothing. [apps/server/internal/lib/connectors/dropbox.go:547-557]
- `delete:` never-raised gateway errors `errNoSuchUpload`/`errInvalidBucketName`/`errInvalidPart`; unused `graphItem.ParentReference`/`DownloadURL`. Replacement: nothing. [apps/server/internal/handlers/s3gateway/errors.go, internal/lib/connectors/onedrive.go:46-54]
- `delete:` Lexical editor stack (`lexical`, `@lexical/*`, `@lexkit/editor`) + `components/block/editor/` + `RichTextEditorField` — registered in `hooks/form.tsx` but no form instantiates it; unreachable from any route. Replacement: nothing (re-add when needed). [apps/web/package.json:27-32,51]
- `delete:` `pluralize` + `@types/pluralize` — zero imports. Replacement: nothing. [apps/web/package.json:57,77]
- `delete:` config that is never read: `MACHINE_ID` (required at boot, read nowhere), `S3.ClientID/ClientSecret/Region/Endpoint/Token`, `RESEND_DEBUG_TO_EMAIL` mandatory-but-unread gate, `App.MachineID`, `EnvStaging`. Replacement: delete the flags/gates. [apps/server/cmd/api/flag.go, internal/config/config.go]
- `delete:` the `"Hello, World!"` `/api` stub — dev leftover. Replacement: nothing. [apps/server/cmd/api/routes.go:16-22]
- `stdlib:` `randRead` wraps `crypto/rand.Read` for no reason. Replacement: `crypto/rand.Read` directly. [apps/server/internal/lib/connectors/gdrive.go:24-26]
- `native:` `lodash` imported for one `isEmpty`. Replacement: a plain `length`/null check. [apps/web/src/lib/api/client-fetch.ts]
- `yagni:` `partOffsets` maps on per-request connectors — always zero, multipart offsets broken (see functional bugs). Replacement: thread the offset through the request or store uploads server-side. [dropbox.go:34, onedrive.go:35]
- `yagni:` `gdriveConnector.paths` cache on per-request connectors — always cold; its coldness is what exposes SEC-006. Replacement: cache at registry lifetime or delete. [gdrive.go:46-47]
- `yagni:` `S3Bucket.RootPrefix` management CRUD without enforcement. Replacement: enforce it (SEC-004) or drop the column. [models/s3.go:28-38]

**net: ~-900 lines, -9 deps possible** (dead repo methods ~200, editor stack ~500 incl. deps, whereBuilder ~60, misc config/errors ~100).

## Functional bugs surfaced by the lean pass (correctness, not security)

1. **Dropbox list continuation is broken** — **fixed 2026-10-25** (listContinue now decodes via `decodeDropboxCursor` and binds the token to the listing prefix) — `listContinue` (`dropbox.go:503`) runs `strings.Cut(cursor, "\x00")` on the raw query value, but cursors are base64 (`encodeDropboxCursor`); base64 never contains `\x00`, so every continuation fails with "invalid continuation token".
2. **OneDrive/Dropbox multipart part offsets are always 0** — **fixed 2026-10-25** (package-level offset store; connectors are per-request) — `partOffsets` lives on per-request connector instances (`partOffsets[uploadID] = offset` is a self-assignment); ordered-part uploads would overwrite the same first bytes.
3. **`ListMultipartUploads` is a stub** returning an empty list (documented in the README) — accepted, cross-request upload discovery is a feature.
4. **`RESEND_DEBUG_TO_EMAIL` is mandatory at boot but read nowhere** — **fixed 2026-10-25** (gate removed; flag kept for future wiring) — every deploy must set a variable that does nothing.

---

*Remediation order suggestion: SEC-001 and SEC-002 (one regex each + a host allowlist) → SEC-003 → SEC-004/SEC-006 (connector correctness + isolation) → SEC-005/SEC-008 (token storage + CSP) → the functional bugs 1-2 → the rest by opportunity.*
