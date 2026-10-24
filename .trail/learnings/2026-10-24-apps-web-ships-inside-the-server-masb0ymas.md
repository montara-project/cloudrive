---
title: apps/web ships inside the server image; Docker context is the repo root
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 13, tokens: 166005 }
id: l-1596e1f9
scope: repo
status: active
touches:
  - apps/app/app/(dashboard)/providers/page.tsx
  - apps/app/app/preview/page.tsx
  - apps/app/components/block/settings/storage-panel.tsx
  - apps/app/components/layout/global-search.tsx
  - apps/app/data/sidebar-menu.ts
  - pnpm-lock.yaml
  - apps/web/index.html
---

## Decided
- `apps/web` is a Vite SPA (vine `vite` variant, TanStack Router) served by the Go API at `/` via `SPA_DIR` (`apps/server/internal/middlewares/spa.go`, mounted after `routes()` in `cmd/api/server.go`). `/v1` and `/health` stay API-only. One origin, so the forms call `/v1/...` relatively and need no CORS.
- `apps/server/Dockerfile` builds from the repo root (`docker build -f apps/server/Dockerfile .`): the web stage needs the root `pnpm-lock.yaml`. Its ignore file is `apps/server/Dockerfile.dockerignore` (BuildKit), not a root `.dockerignore`. CI `server-release.yaml` uses `context: .`.
- Kept the custom alpine Dockerfile and `scripts/entrypoint.sh` (env -> flags, `spa-dir:SPA_DIR`) and hand-applied gofi's embedded-SPA pattern, because `apply_deploy.py --mode embedded` replaces them with a distroless template and drops the `/app/migrate` path `boot_recovery.go` probes.
- Default `<title>`/description/OG tags live only in `apps/web/index.html`. Routes add their own via `head` and `<HeadContent />` in `__root.tsx`. A root-route `head` duplicated them.
- Cloudflare Workers deploy of web removed (`.github/workflows/pull-request.yaml` deleted); the site releases with the server image on `v*` tags.

## Tried and ruled out
- Running `gofi:deploy`'s `apply_deploy.py`: it rewrites the Dockerfile and entrypoint wholesale (see above).
- Keeping vine's dashboard starter (auth, sidebar, organization CRUD, shadcn ui): apps/web is a marketing site with no sign-in, so only the skeleton (`config/env.ts`, `lib/api` dtos/models/services/queries, react-query provider) stays.

## Watch out
- `middlewares.SPA` reads `index.html` once at startup. After `pnpm build:web`, restart a locally running API or it serves stale bundle hashes (JS 404s, blank page).
- `POST /v1/waitlist` and `/v1/contact` do not exist on the server yet; the forms show "Something went wrong" until they do.
