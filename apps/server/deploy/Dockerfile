FROM golang:1.26-alpine AS builder
LABEL author="masb0ymas"
LABEL name="cloudrive-api"

WORKDIR /temp-build

RUN apk update && apk add --no-cache make

# We want to populate the module cache based on the go.{mod,sum} files.
COPY go.mod .
COPY go.sum .

RUN go mod download

COPY . .

RUN cp .env.production .env

# Build the application
RUN make build/api
RUN make build/migrate

# Create the final image
FROM alpine:3.21
LABEL author="masb0ymas"
LABEL name="cloudrive-api"

WORKDIR /app
RUN apk add ca-certificates tzdata nano make

# Copy the built application
COPY --from=builder /temp-build/bin/api /app/api
COPY --from=builder /temp-build/bin/migrate /app/migrate
COPY --from=builder /temp-build/migrations /app/migrations
COPY --from=builder /temp-build/templates /app/templates
COPY --from=builder /temp-build/public /app/public
COPY --from=builder /temp-build/scripts/Makefile /app/Makefile
COPY --from=builder /temp-build/.env /app/.env

# Expose the port
EXPOSE 8080

# Run the application via Makefile
# ENTRYPOINT ["make", "-f", "/app/Makefile", "run/prod"]
ENTRYPOINT ["./api"]
CMD ["--env=production", "--port=8080"]
