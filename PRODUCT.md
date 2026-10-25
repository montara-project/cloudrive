# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Individuals who juggle several personal cloud storage accounts (Google Drive,
Dropbox, OneDrive, S3-compatible buckets) and sign up for a hosted web service to
unify them. Their job: find and get to the right file without hopping between
provider tabs, and reach everything through the tools they already use (browser,
S3 clients, SDKs). Organizations and workspaces exist in the product, but the
confirmed primary audience is the individual subscriber, not teams or
self-hosters.

## Product Purpose

Cloudrive connects existing cloud storage accounts to a workspace, lets people
browse them as one drive, and lets any S3 client (aws-cli, rclone, SDKs) read and
write them through a single S3-compatible gateway. Files stay where they are:
Cloudrive stores credentials and mappings, never copies of the user's data.
Success is a person consolidating "where is my file?" across clouds into one
place on day one and keeping it there.

## Positioning

Zero-migration unification: connect accounts in minutes and get one drive, one
REST API, and one S3-compatible endpoint across them — with no copying, no
syncing, and no vendor lock-in of the underlying files. A competitor can build a
sync tool or a config-heavy CLI; the claim Cloudrive stands on is that standard
S3 clients and a single drive work directly against the user's existing
providers, with credentials kept encrypted and data left in place.

## Operating Context

- Pre-launch waitlist mode on the public site: the conversion event is joining a
  waitlist (email + queue position), not purchasing. "Early access" language is
  the norm.
- The signed-in app is functional: sign-up, first-run onboarding (survey,
  organization, workspace), drive browsing, storage-account connection, S3
  gateway management, settings.
- A developer documentation site (`apps/docs`, Next.js + Fumadocs) covers
  architecture, data model, API reference, and deployment for contributors and
  the curious.
- Deployment target is a single Docker image that serves the API, the S3
  gateway, and the built SPA.
- Local dev: API on :8080, web dev server on :3000 (proxies `/api`), docs on
  :3001.

## Capabilities and Constraints

- Providers: `google_drive`, `onedrive`, `dropbox`, `s3_compatible` (catalog
  decides the connector).
- Tenancy: Organization (roles owner/admin/member) → Workspace (roles
  admin/member/viewer) → storage accounts, S3 credentials, bucket mappings.
- Storage-account credentials live encrypted in a separate vault table; the app
  never stores copies of user files.
- S3 bucket mapping: a bucket name the gateway serves, pointing at one storage
  account and an optional prefix.
- Auth: Authula-based sessions with JWT access tokens and rotating refresh
  tokens (cookie-based).
- Everything ships under one origin: one Go server (Fiber v3) serves `/api/*`,
  the S3 gateway, and the SPA build.
- **Placeholder proof:** the landing page's testimonials (Nimbus Labs, Dataship,
  Quantify), stats, and pricing tiers (Free / $12 Pro / $29 Team) are invented
  design content. They are not factual claims, customer evidence, or pricing
  commitments; future work must not cite or preserve them as truth.

## Brand Commitments

- Name: "Cloudrive".
- Product copy is in English.

## Evidence on Hand

- A working end-to-end product in the repo: sign-up, onboarding wizard, drive,
  storage accounts, S3 gateway, settings (`apps/web`, `apps/server`).
- Real waitlist infrastructure: API with queue-position responses and a landing
  form (`apps/web/src/components/block/landing/waitlist-form.tsx`).
- Developer documentation content and design records: `apps/docs/content/docs`,
  `docs/` (ERD, provider OAuth PRD, S3 gateway notes).
- No real customer testimonials, case studies, press, or usage benchmarks exist.
  The landing page's people, numbers, and prices are placeholders that must not
  be presented as proof.

## Product Principles

1. **Zero-copy honesty.** Files stay in the provider. Copy, sync, and migration
   implications are off-brand; say "connect", not "move".
2. **One place beats five tabs.** Every surface should compound the promise of
   unified browse and search across clouds.
3. **Standard protocols win.** S3 clients and the REST API must work unmodified;
   compatibility outranks novelty.
4. **Credentials are the trust surface.** Encrypted vault, scoped mappings,
   least privilege — security posture is part of the product's meaning.
5. **No fabricated proof.** Pre-launch, the waitlist is the only real conversion
   metric; invented quotes and numbers never stand in for evidence.
