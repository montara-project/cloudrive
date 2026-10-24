---
title: Every app must share the root TypeScript major or oxlint pre-commit breaks
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 2, tokens: 17769 }
id: l-b2b15e83
scope: repo
status: active
touches:
  - apps/web/.env.example
  - apps/web/.gitignore
  - apps/web/.oxfmtrc.json
  - apps/web/.vscode/settings.json
  - apps/web/README.md
  - apps/web/index.html
---

## Decided
- `apps/web/package.json` uses `typescript ~7.0.2`, same as the root `package.json` (and `latest` in `apps/app`), not the `^6` the vine scaffold pins.

## Watch out
- `eslint-plugin-perfectionist` peers on typescript, so a second TS major gets it a second `.pnpm` install. The root `.oxlintrc.json` and a nested `apps/*/.oxlintrc.json` then load two copies, and the husky/lint-staged `oxlint --fix` fails with "Plugin name 'perfectionist' is already registered". Check with `realpath apps/*/node_modules/eslint-plugin-perfectionist`: all paths must match.
