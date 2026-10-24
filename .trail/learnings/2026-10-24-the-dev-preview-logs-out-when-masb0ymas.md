---
title: The dev /preview logs out when a real API answers on the proxy target
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 9, tokens: 117332 }
id: l-263fe3f2
scope: repo
status: active
touches:
  - apps/docs/content/docs/backend/s3-gateway.mdx
  - apps/docs/content/docs/frontend/index.mdx
  - apps/docs/content/docs/frontend/routing.mdx
  - apps/web/src/components/block/dashboard/content.tsx
  - apps/web/src/components/block/dashboard/dashboard-toolbar.tsx
  - apps/web/src/components/block/dashboard/welcome-header.tsx
  - apps/web/src/components/block/drive/content.tsx
  - apps/web/src/components/block/drive/drive-file-list.tsx
  - apps/web/src/components/block/drive/recent-content.tsx
  - apps/web/src/components/block/drive/shared-content.tsx
---

## Watch out
- `apps/web/src/routes/preview/index.tsx` seeds a fake session (`preview-token`) and mock data only for the queries it knows. Any panel that fetches something unseeded (e.g. Settings → S3 Gateway credentials) sends the fake token through the `/v1` proxy. If an API is running on `VITE_API_PROXY_TARGET` (default `http://localhost:8080`), it answers 401, `lib/api/client-fetch.ts` clears the tokens and redirects to `/sign-in`. That's not a bug in the page under review.
- To screenshot or review new panels in `/preview`, point the proxy at a dead port: `VITE_API_PROXY_TARGET=http://127.0.0.1:9 pnpm exec vite preview …`. Unseeded requests then fail as network errors, which do not sign out.
- Headless Chrome with `--virtual-time-budget` hangs on `vite dev` (HMR socket + devtools); take screenshots from a `vite build --mode development` bundle served by `vite preview` instead.
