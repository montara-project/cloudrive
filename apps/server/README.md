# cloudrive server

Go API server for cloudrive — organizations, workspaces, connected storage
accounts, and an S3-compatible gateway that fronts those accounts. Built on
Fiber v3, PostgreSQL (via `database/sql` + `lib/pq`), and Authula for
authentication.

## Layout

- `cmd/api` — HTTP server entrypoint (`main.go`, `routes.go`, `server.go`)
- `cmd/migrate` — migration runner
- `internal/handlers` — JSON REST handlers (management API)
- `internal/handlers/s3gateway` — S3-compatible gateway (XML, path-style, SigV4)
- `internal/lib/connectors` — storage provider connectors
- `internal/lib` — cross-layer utilities (`apperr`, `validator`, `secretbox`, `sigv4`, `provideroauth`, `email`)
- `internal/repositories`, `internal/models`, `internal/dtos` — data layer
- `migrations` — SQL migrations (golang-migrate format)

## Running

```sh
cp .env.example .env       # fill in DB_DSN, STORAGE_CREDENTIALS_KEYS, etc.
make db/migrations/up      # apply migrations (add /seed for dev seeders)
make run                   # go run ./cmd/api with configuration from .env
```

`make build/api` and `make build/migrate` produce binaries in `./bin`.

## Container

The Dockerfile builds a minimal Alpine image (`api` + `migrate` binaries,
migrations, templates, static assets, and the `apps/web` SPA) running as a
non-root user. Its build context is the repo root, since it also builds the
SPA; the API serves it at `/` from `SPA_DIR=/app/web` (empty disables it),
while `/api` stays API-only. The API
listens on 8080; the S3 gateway on `S3_API_PORT` (default 9000, `0` disables it).

The binary reads its configuration from environment variables using the
same names as `.env.example` (a flag passed after the image name still
overrides its variable):

```sh
docker build -f apps/server/Dockerfile -t cloudrive-api .
docker run -e MACHINE_ID=1 -e APP_SECRET=... -e DB_DSN=... \
    -e CLIENT_URL=... -e SERVER_URL=... \
    -e RESEND_API_KEY=... -e RESEND_FROM_EMAIL=... -e RESEND_DEBUG_TO_EMAIL=... \
    -e STORAGE_CREDENTIALS_KEYS=v1:<base64-32-byte-key> \
    -e MIGRATE_ON_BOOT=true -p 8080:8080 cloudrive-api
```

Only set variables take effect, so compose `env_file` or `docker run -e`
work directly; no `.env` is baked into the image.

Auth endpoints are served by Authula under `/api/v1/auth`. Everything else under
`/api/v1` requires a bearer token (`Authorization: Bearer <jwt>`).

## S3 gateway

The gateway has two surfaces:

1. **Management API** — JSON endpoints on the main listener for issuing
   SigV4 credentials and mapping bucket names onto storage accounts.
2. **S3-compatible API** — a dedicated Fiber app on `S3_API_PORT` (default
   `9000`; `0` disables it) speaking the AWS S3 REST dialect: XML bodies,
   path-style addressing, SigV4 auth (header or presigned URL). Point any
   S3 client at it with the issued access key/secret.

### Management endpoints

Registered in `cmd/api/routes.go`, implemented in
`internal/handlers/s3_gateway.go`. All require a bearer token; create/delete
operations additionally require org `owner` or `admin` role.

| Method   | Path                                                | Handler            | Description                                                                               |
| -------- | --------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/workspaces/:wsId/s3/credentials`               | `CreateCredential` | Issue a SigV4 access key. The secret is returned once and stored encrypted (AES-256-GCM). |
| `GET`    | `/api/v1/workspaces/:wsId/s3/credentials`               | `ListCredentials`  | List the workspace's access keys (secrets never returned). Paginated.                     |
| `DELETE` | `/api/v1/workspaces/:wsId/s3/credentials/:credentialId` | `RevokeCredential` | Revoke an access key; it stops authenticating immediately.                                |
| `POST`   | `/api/v1/workspaces/:wsId/s3/buckets`                   | `CreateBucket`     | Map an S3 bucket name onto a connected storage account (optional `root_prefix`).          |
| `GET`    | `/api/v1/workspaces/:wsId/s3/buckets`                   | `ListBuckets`      | List the workspace's bucket mappings. Paginated.                                          |
| `DELETE` | `/api/v1/workspaces/:wsId/s3/buckets/:bucketId`         | `DeleteBucket`     | Remove the bucket mapping; objects in the backing account are untouched.                  |

### S3-compatible endpoints

Implemented in `internal/handlers/s3gateway/handler.go` (`Register`). Path-style
only: the first path segment is the bucket, the rest is the object key.
Errors are S3 XML error documents.

| Method           | Path                                      | S3 operation                | Notes                                                                            |
| ---------------- | ----------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `GET`            | `/`                                       | ListBuckets                 | Lists bucket mappings of the credential's workspace.                             |
| `GET`            | `/{bucket}`                               | ListObjectsV2               | Supports `prefix`, `delimiter`, `continuation-token`, `max-keys` (default 1000). |
| `GET`            | `/{bucket}?uploads`                       | ListMultipartUploads        | Stub: returns an empty list (cross-request upload discovery not implemented).    |
| `HEAD`           | `/{bucket}`                               | HeadBucket                  | 200 if the bucket mapping resolves to an active account.                         |
| `PUT` / `DELETE` | `/{bucket}`                               | CreateBucket / DeleteBucket | `AccessDenied` — buckets are managed via the management API.                     |
| `GET`            | `/{bucket}/{key}`                         | GetObject                   | Streams the object from the backing connector.                                   |
| `HEAD`           | `/{bucket}/{key}`                         | HeadObject                  | `ETag`, `Last-Modified`, `Content-Type`, `Content-Length`.                       |
| `PUT`            | `/{bucket}/{key}`                         | PutObject                   | Streams through to the connector; `aws-chunked` bodies are decoded.              |
| `DELETE`         | `/{bucket}/{key}`                         | DeleteObject                | Returns 204.                                                                     |
| `POST`           | `/{bucket}/{key}?uploads`                 | CreateMultipartUpload       | Initiates a multipart upload.                                                    |
| `PUT`            | `/{bucket}/{key}?partNumber=N&uploadId=…` | UploadPart                  | `partNumber` 1–10000; `aws-chunked` supported.                                   |
| `POST`           | `/{bucket}/{key}?uploadId=…`              | CompleteMultipartUpload     | Body is the S3 `CompleteMultipartUpload` XML.                                    |
| `DELETE`         | `/{bucket}/{key}?uploadId=…`              | AbortMultipartUpload        | Returns 204.                                                                     |

Authorization on the data plane: the signed credential's workspace must own
the bucket mapping, and the backing storage account must be `active`.
