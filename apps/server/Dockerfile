FROM golang:1.26-alpine AS builder
LABEL author="masb0ymas"
LABEL name="cloudrive-api"

WORKDIR /temp-build

# We want to populate the module cache based on the go.{mod,sum} files.
COPY go.mod .
COPY go.sum .

RUN go mod download

COPY . .

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
COPY --chmod=0755 scripts/entrypoint.sh /app/entrypoint.sh

USER cloudrive

# 8080 = REST API; 9000 = S3-compatible gateway (enabled via S3_API_ADDR)
EXPOSE 8080 9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" >/dev/null || exit 1

# Configuration comes from environment variables; entrypoint.sh maps them
# onto the binary's flags. CMD holds image defaults that env vars override
# (env-derived flags are appended after these).
ENTRYPOINT ["./entrypoint.sh"]
CMD ["--env=production", "--port=8080"]
