-include .env

# ==================================================================================== #
# HELPERS
# ==================================================================================== #

## help: print this help message
.PHONY: help
help:
	@echo 'Usage:'
	@sed -n 's/^##//p' $(MAKEFILE_LIST)

# ==================================================================================== #
# DEVELOPMENT
# ==================================================================================== #

## run: start the API with the baked production configuration
#
# Secret values (APP_SECRET, DB_DSN, RESEND_API_KEY, the OAuth client
# secrets, SUPER_USER, STORAGE_CREDENTIALS_KEYS) are deliberately NOT passed
# as flags: `ps` exposes argv to every local process, and the binary reads
# the same names from its environment (which `-include .env` provides).
.PHONY: run
run:
	@./api \
		--machine-id=$(MACHINE_ID) \
		--debug=$(DEBUG) \
		--env=$(ENV) \
		--port=$(PORT) \
		--app-name=$(APP_NAME) \
		--client-url=$(CLIENT_URL) \
		--server-url=$(SERVER_URL) \
		--cors-allowed-origins=$(CORS_ALLOWED_ORIGINS) \
		--db-max-open-conns=$(DB_MAX_OPEN_CONNS) \
		--db-max-idle-conns=$(DB_MAX_IDLE_CONNS) \
		--db-max-idle-time=$(DB_MAX_IDLE_TIME) \
		--resend-from-email=$(RESEND_FROM_EMAIL) \
		--resend-debug-to-email=$(RESEND_DEBUG_TO_EMAIL) \
		--google-client-id=$(GOOGLE_CLIENT_ID) \
		--s3-api-port=$(S3_API_PORT) \
		--s3-staging-dir=$(S3_STAGING_DIR) \
		--trusted-proxies=$(TRUSTED_PROXIES) \
		--typesafe-api-key=$(TYPESAFE_API_KEY) \
		--typesafe-api-url=$(TYPESAFE_API_URL) \
		--migrate-on-boot=$(MIGRATE_ON_BOOT)

## db/migrations/up: apply all up database migrations
.PHONY: db/migrations/up
db/migrations/up:
	./migrate --db-dsn=$(DB_DSN) up

## db/migrations/up/seed: apply all up database migrations and run seeders
.PHONY: db/migrations/up/seed
db/migrations/up/seed:
	./migrate --db-dsn=$(DB_DSN) --seed=prod up

## db/migrations/down: apply all down database migrations
.PHONY: db/migrations/down
db/migrations/down:
	./migrate --db-dsn=$(DB_DSN) down

## db/migrations/refresh: apply all refresh database migrations
.PHONY: db/migrations/refresh
db/migrations/refresh:
	./migrate --db-dsn=$(DB_DSN) refresh

## db/migrations/refresh/seed: apply all refresh database migrations and run seeders
.PHONY: db/migrations/refresh/seed
db/migrations/refresh/seed:
	./migrate --db-dsn=$(DB_DSN) --seed=prod refresh

## run/prod: apply migrations, then start the API
.PHONY: run/prod
run/prod: db/migrations/up run
