#!/bin/sh
# Container entrypoint: translates environment variables into the api
# binary's CLI flags (the binary itself reads flags only). Only non-empty
# variables become flags, so binary defaults apply to the rest; required
# values (MACHINE_ID, APP_SECRET, DB_DSN, ...) are enforced by the binary's
# own flag validation.
#
# Env-derived flags are appended after any CMD args, so image defaults set
# via CMD (e.g. --env=production) are overridable by environment.
set -eu

for pair in \
	machine-id:MACHINE_ID \
	debug:DEBUG \
	env:ENV \
	port:PORT \
	app-name:APP_NAME \
	app-secret:APP_SECRET \
	client-url:CLIENT_URL \
	server-url:SERVER_URL \
	cors-allowed-origins:CORS_ALLOWED_ORIGINS \
	trusted-proxies:TRUSTED_PROXIES \
	super-user:SUPER_USER \
	db-dsn:DB_DSN \
	db-max-open-conns:DB_MAX_OPEN_CONNS \
	db-max-idle-conns:DB_MAX_IDLE_CONNS \
	db-max-idle-time:DB_MAX_IDLE_TIME \
	resend-api-key:RESEND_API_KEY \
	resend-from-email:RESEND_FROM_EMAIL \
	resend-debug-to-email:RESEND_DEBUG_TO_EMAIL \
	google-client-id:GOOGLE_CLIENT_ID \
	google-client-secret:GOOGLE_CLIENT_SECRET \
	s3-client-id:S3_CLIENT_ID \
	s3-client-secret:S3_CLIENT_SECRET \
	s3-region:S3_REGION \
	s3-endpoint:S3_ENDPOINT \
	s3-token:S3_TOKEN \
	s3-api-addr:S3_API_ADDR \
	s3-staging-dir:S3_STAGING_DIR \
	storage-credentials-keys:STORAGE_CREDENTIALS_KEYS \
	typesafe-api-key:TYPESAFE_API_KEY \
	typesafe-api-url:TYPESAFE_API_URL \
	migrate-on-boot:MIGRATE_ON_BOOT
do
	flag=${pair%%:*}
	var=${pair##*:}
	val=$(printenv "$var" || true)
	if [ -n "$val" ]; then
		set -- "$@" "--$flag=$val"
	fi
done

# exec replaces the shell so the server receives SIGTERM directly.
exec ./api "$@"
