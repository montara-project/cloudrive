---
title: "release-it bumps from the root package.json version, which must match the latest v* tag"
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 14, tokens: 105084 }
id: l-ca5f4327
scope: repo
status: active
touches:
  - ".dockerignore"
  - ".github/workflows/react-doctor.yml"
  - ".github/workflows/release-prepare.yml"
  - ".github/workflows/release-publish.yml"
  - ".github/workflows/release.yml"
  - ".release-it.json"
  - apps/docs/Dockerfile
  - apps/docs/content/docs/backend/index.mdx
  - apps/docs/content/docs/deployment.mdx
---

## Decided
- Releases go through `.github/workflows/release-prepare.yml` → `release-publish.yml` → `release.yml` with release-it (`.release-it.json`, root `package.json` scripts `release:prepare` / `release:publish`), ported from montara-pass. `apps/server/scripts/release.sh` and `make release` were removed so there is one release path.
- Root `package.json` `version` was set to `0.2.0` = the latest tag `v0.2.0`. release-it (npm plugin, `publish: false`) reads the current version from that field, not from the tag: left at `0.0.0` it would bump to `0.1.0`, a tag that already exists.
- `.dockerignore` lives at the repo root: both images build with context `.` (`apps/server/Dockerfile`, `apps/docs/Dockerfile`), and BuildKit only reads `<context>/.dockerignore` or `<Dockerfile>.dockerignore`. An `apps/server/.dockerignore` is ignored, which sends `.env` files and `node_modules` into the build context.

## Watch out
- `pnpm release:prepare --dry-run` still runs the `after:bump` hook (`scripts/sync-versions.mjs`), rewriting `apps/*/package.json` versions to the root version.
- Release Prepare opens its PR with `GITHUB_TOKEN`; the repo needs "Allow GitHub Actions to create and approve pull requests".
