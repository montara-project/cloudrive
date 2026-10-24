# Cloudrive web

Marketing site (landing, contact, privacy, terms) as a Vite SPA with TanStack
Router, generated from [masb0ymas/vine](https://github.com/masb0ymas/vine)
(`vite`). In production the Go API (`apps/server`) serves the build at `/`;
see `apps/server/Dockerfile`.

## Scripts

- `pnpm dev:web` starts the dev server on :3000 (proxies `/v1` to the API on :8080).
- `pnpm build:web` builds `dist/`.
- `pnpm --filter @cloudrive/web preview` serves the built SPA locally.
- `pnpm --filter @cloudrive/web generate-routes` regenerates `src/routeTree.gen.ts` (commit it).

To serve the build from a local API: `pnpm build:web`, then set
`SPA_DIR=../web/dist` in `apps/server/.env` and `pnpm dev:server`.

Environment variables are documented in `.env.example`.
