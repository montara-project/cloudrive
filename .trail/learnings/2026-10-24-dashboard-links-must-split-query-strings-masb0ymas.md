---
title: "Dashboard links must split query strings out of TanStack Router's to"
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 31, tokens: 374324 }
id: l-7966c0f3
scope: repo
status: active
touches:
  - ".github/workflows/server-release.yaml"
  - apps/server/.env.example
  - apps/server/Dockerfile
  - apps/server/Dockerfile.dockerignore
  - apps/server/Makefile
  - apps/server/README.md
  - apps/server/cmd/api/flag.go
  - apps/server/cmd/api/routes.go
  - apps/server/cmd/api/server.go
---

## Decided
- `apps/app` (vinext dashboard) was merged into `apps/web` (vine vite SPA) and deleted. Sign-in moved from `/` to `/sign-in` because `/` is now the marketing landing page; every former `navigate('/')`/`window.location.href = '/'` that meant "go sign in" now targets `/sign-in` (`hooks/use-session.ts`, `lib/api/client-fetch.ts`, `components/block/onboarding/onboarding-gate.tsx`, `components/block/auth/dashboard-gate.tsx`).
- Dashboard links carry `?org=`/`?ws=` built as strings (`scopedHref` in `components/layout/sidebar/nav-main.tsx`, `global-search.tsx`, `drive-file-list.tsx`). TanStack Router matches `to` as a path only, so they go through `hrefToLocation()` in `apps/web/src/lib/utils.ts`; static targets use `search={{ tab }}` and `routes/(dashboard)/settings/index.tsx` declares `validateSearch` for `tab`/`view`.
- The two designs share one `src/styles.css`: dashboard tokens on `:root`/`.dark`, marketing palette and Poppins re-declared under `.marketing`, applied by `routes/(marketing)/route.tsx`. Keeps both looks without renaming tokens in either codebase.
- `apps/docs` uses the Fumadocs MDX Config API (`source.config.ts`, `collections/*` path) as `.claude/skills/fumadocs` requires; `create-fumadocs-app` generates the macro API, so it was converted.

## Tried and ruled out
- Passing `'/settings?tab=x'` or `` `/storage?org=${id}` `` straight to `to`: a literal fails typecheck, and a `string` compiles but drops the query at runtime.

## Watch out
- Never use `dark:` utilities inside `.marketing` components: the marketing palette has no dark variant.
