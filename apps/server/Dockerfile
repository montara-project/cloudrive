# syntax=docker/dockerfile:1
# Build context is the repo root: the image also carries the apps/web SPA,
# which the API serves at / (SPA_DIR) next to /v1 and /health.
#
#   docker build -f apps/server/Dockerfile -t cloudrive-api .

# ---- SPA: built once on the builder's platform; the output is plain files.
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /repo
RUN corepack enable

# Workspace manifests first, so the dependency layer is reused until they change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @cloudrive/web

# The SPA calls the API relatively (/v1/...): same origin, nothing to bake in.
# vite build directly: the package's prebuild (format/lint/typecheck) is a
# dev/CI step, not an image step.
COPY apps/web/ apps/web/
RUN pnpm --filter @cloudrive/web exec vite build && test -f apps/web/dist/index.html

# ---- API
FROM golang:1.26-alpine AS builder
LABEL author="masb0ymas"
LABEL name="cloudrive-api"

WORKDIR /temp-build

# We want to populate the module cache based on the go.{mod,sum} files.
COPY apps/server/go.mod .
COPY apps/server/go.sum .

RUN go mod download

COPY apps/server/ .

# Build only the binaries the image ships. The make build/* targets also
# cross-compile linux_amd64, which is wasted work inside the container —
# the native-arch binary is the one copied below.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s" -o=./bin/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s" -o=./bin/migrate ./cmd/migrate

# Create the final image
FROM alpine:3.21
LABEL author="masb0ymas"
LABEL name="cloudrive-api"

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S cloudrive && adduser -S cloudrive -G cloudrive \
    && mkdir -p /app/tmp && chown cloudrive:cloudrive /app/tmp

# Copy the built application. The migrate binary must stay at /app/migrate:
# boot_recovery.go probes that path for MIGRATE_ON_BOOT recovery, and the
# migrate tool reads ./migrations relative to the working directory.
COPY --from=builder /temp-build/bin/api /app/api
COPY --from=builder /temp-build/bin/migrate /app/migrate
COPY --from=builder /temp-build/migrations /app/migrations
COPY --from=builder /temp-build/templates /app/templates
COPY --from=builder /temp-build/public /app/public
COPY --from=web /repo/apps/web/dist /app/web
COPY --chmod=0755 apps/server/scripts/entrypoint.sh /app/entrypoint.sh

# The API serves the SPA at /; an empty SPA_DIR at runtime disables it.
ENV SPA_DIR=/app/web

USER cloudrive

# 8080 = REST API; 9000 = S3-compatible gateway (enabled via S3_API_PORT)
EXPOSE 8080 9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" >/dev/null || exit 1

# Configuration comes from environment variables; entrypoint.sh maps them
# onto the binary's flags. CMD holds image defaults that env vars override
# (env-derived flags are appended after these).
ENTRYPOINT ["./entrypoint.sh"]
CMD ["--env=production", "--port=8080"]
