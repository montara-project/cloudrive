# Rencana: Cloudrive sebagai S3-Compatible Server (Gateway)

**Tujuan**: Cloudrive menyediakan endpoint API S3-compatible sehingga client S3 apa pun (aws-cli, rclone, SDK, MinIO client) bisa upload & manage file. Object fisik di-proksi ke storage account yang terhubung (backend v1: `s3_compatible` + Google Drive). Bucket dipetakan lewat tabel `s3_buckets`.

## Arsitektur

```
S3 Client ──SigV4──▶ S3 Gateway (port terpisah, path-style)
                        │ verifikasi access key (s3_credentials)
                        │ lookup bucket (s3_buckets → storage_account)
                        ▼
                 Connector Registry (by providers.protocol)
                 ├── s3_connector (proxy ke MinIO/AWS/R2, multipart passthrough)
                 └── gdrive_connector (resumable upload, multipart di-staging lokal)
```

## Tahap 1 — Migrasi & model (`000005_create_s3_gateway_schema`)

- **`s3_credentials`**: kredensial SigV4 yang diterbitkan Cloudrive — `id`, `organization_id`, `workspace_id` (composite FK pola 000003), `user_id` FK, `access_key_id text UNIQUE`, `secret_key_encrypted text` + `key_id` (enkripsi ulang `secretbox.SecretBox` yang sudah ada), `label`, `last_used_at`, `created_at/updated_at`. Pola repo mengikuti `storage_account.go` (enkripsi di dalam repository, `Credentials()` untuk dekripsi).
- **`s3_buckets`**: pemetaan bucket → akun — `id`, `organization_id`, `workspace_id`, `name text UNIQUE` (namespace bucket global), `storage_account_id FK`, `root_prefix text` (default `''`), `created_by FK`, timestamps. Bucket = jalur ke satu storage account + prefix root.
- Seeder: tambah row provider `s3_compatible` (protocol `s3_compatible`, auth `access_key`) di `internal/seeders/provider.go`.
- Model + repository baru + registrasi di `repositories/factory.go`.

## Tahap 2 — Abstraksi connector (`internal/connectors/`)

- Interface `Connector` per storage account: `PutObject`, `GetObject` (stream `io.Reader`), `StatObject`, `DeleteObject`, `ListObjects(prefix)`, dan multipart: `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`.
- `Registry` memilih implementasi berdasar `providers.protocol` + kredensial terdekripsi via `StorageAccountRepository.Credentials(id)`.
- **S3 connector** — dependency `github.com/minio/minio-go/v7` (ringan, ramah endpoint S3-compatible apa pun, streaming & multipart bagus). Endpoint/region dibaca dari `storage_accounts.settings` + kredensial.
- **Google Drive connector** — OAuth2 token dari kredensial tersimpan; upload resumable, download stream, delete, list folder. Multipart untuk backend non-S3 di-staging ke direktori temp lokal (`S3_STAGING_DIR`) lalu digabung saat Complete. (Kalau scope Drive ternyata terlalu besar saat eksekusi, connector-nya tetap dibuat dengan operasi dasar dan multipart menyusul — interface sudah menyiapkannya.)

## Tahap 3 — Verifikasi AWS SigV4 (`internal/lib/sigv4/`)

Implementasi in-house (~1 file + middleware): parse `Authorization` header & varian presigned (`X-Amz-Signature` di query), bangun canonical request (method, path, query, header `host` + `x-amz-*`, payload hash `UNSIGNED-PAYLOAD`/`STREAMING-*`), hitung HMAC dengan secret terdekripsi, bandingkan constant-time. Unit test dengan test vector resmi AWS. `STREAMING-AWS4-HMAC-SHA256-PAYLOAD` (chunked upload dari aws-cli) ditangani di tahap ini minimal dengan decode chunk; kalau kompleks, v1 menolak dengan error jelas dan mengandalkan client tanpa streaming signing.

## Tahap 4 — S3 Gateway handlers (listener kedua)

- Listener Fiber kedua di `cmd/api` (addr dari config baru `S3_API_ADDR`, default `:9000`), **path-style only** (`/{bucket}/{key}`), response XML (`encoding/xml`, format error `Error` S3 standar: `NoSuchBucket`, `NoSuchKey`, `AccessDenied`, `SignatureDoesNotMatch`, dll).
- Operasi: `ListBuckets`, `CreateBucket`/`DeleteBucket`/`HeadBucket` (validasi nama bucket vs `s3_buckets`), `ListObjectsV2` (prefix, delimiter, max-keys, continuation), `PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, dan multipart (`POST ?uploads`, `PUT ?partNumber&uploadId`, `POST ?uploadId`, `DELETE ?uploadId`).
- Setiap operasi: SigV4 → access key → workspace → bucket → storage account → connector → proxy; tulis `last_used_at` di `s3_credentials`.

## Tahap 5 — Presigned URL

- `GetObject`/`PutObject` dengan query SigV4 + `X-Amz-Expires`/`X-Amz-Date`: verifikasi expiry di middleware sigv4 yang sama (tidak perlu state server). Generate presigned dilakukan client sendiri dengan access key/secret Cloudrive — tidak perlu endpoint generate terpisah di v1.

## Tahap 6 — REST API manajemen (session Authula, `/v1`)

- `POST/GET/DELETE /v1/workspaces/:wsId/s3/credentials` — terbitkan access key (secret ditampilkan sekali), list, revoke. Hanya org owner/admin + member workspace.
- `POST/GET/DELETE /v1/workspaces/:wsId/s3/buckets` — CRUD mapping bucket (nama, storage_account_id, root_prefix), validasi nama bucket S3 (3–63 char, lowercase, dll).
- Handler + registrasi di `handlers/factory.go` dan `cmd/api/routes.go`.

## Tahap 7 — Verifikasi & dokumentasi

- Unit test: sigv4 (test vector AWS), validasi nama bucket, repo.
- Integration test: MinIO via testcontainers-go (sudah ada di go.mod sebagai indirect) — put/get/list/multipart end-to-end melalui gateway dengan minio-go sebagai client.
- Update `.env.example` (`S3_API_ADDR`, `S3_STAGING_DIR`), contoh konfigurasi aws-cli/rclone, dan catatan di `docs/erd-cloud-storage.md`.

## Keputusan desain yang saya ambil

1. **minio-go v7** sebagai client backend S3 (bukan aws-sdk-go-v2) — satu dependency, cocok untuk gateway.
2. **SigV4 in-house** — library verifikasi SigV4 Go yang mature tidak diekspor; spesifikasinya kecil dan terdokumentasi baik.
3. **Listener terpisah** untuk S3 API (XML + auth berbeda dari REST JSON), satu binary.
4. **Namespace bucket global** (UNIQUE name) — sederhana dan sesuai semantik S3.
5. Kolom `status`/`pending_auth` pada storage account tetap dipakai: bucket hanya melayani akun berstatus `active`.