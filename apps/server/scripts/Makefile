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
.PHONY: run
run:
	@./api \
		--machine-id=$(MACHINE_ID) \
		--debug=$(DEBUG) \
		--env=$(ENV) \
		--port=$(PORT) \
		--app-name=$(APP_NAME) \
		--app-secret=$(APP_SECRET) \
		--client-url=$(CLIENT_URL) \
		--server-url=$(SERVER_URL) \
		--cors-allowed-origins=$(CORS_ALLOWED_ORIGINS) \
		--super-user=$(SUPER_USER) \
		--db-dsn=$(DB_DSN) \
		--db-max-open-conns=$(DB_MAX_OPEN_CONNS) \
		--db-max-idle-conns=$(DB_MAX_IDLE_CONNS) \
		--db-max-idle-time=$(DB_MAX_IDLE_TIME) \
		--resend-api-key=$(RESEND_API_KEY) \
		--resend-from-email=$(RESEND_FROM_EMAIL) \
		--resend-debug-to-email=$(RESEND_DEBUG_TO_EMAIL) \
		--google-client-id=$(GOOGLE_CLIENT_ID) \
		--google-client-secret=$(GOOGLE_CLIENT_SECRET) \
		--s3-client-id=$(S3_CLIENT_ID) \
		--s3-client-secret=$(S3_CLIENT_SECRET) \
		--s3-region=$(S3_REGION) \
		--s3-endpoint=$(S3_ENDPOINT) \
		--s3-token=$(S3_TOKEN) \
		--storage-credentials-keys=$(STORAGE_CREDENTIALS_KEYS) \
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
run/prod: migrate/up run
