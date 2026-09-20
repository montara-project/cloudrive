# S3-Compatible Gateway

Cloudrive menyediakan endpoint API **S3-compatible**: client S3 apa pun
(aws-cli, rclone, MinIO SDK, SDK AWS, Cyberduck, dst) dapat terhubung ke
Cloudrive untuk meng-upload dan mengelola file. Object fisik di-_proxy_ ke
**storage account** yang terhubung (mis. MinIO, AWS S3, Cloudflare R2, atau
Google Drive) — Cloudrive menjadi gerbang tunggal dengan otorisasi,
enkripsi kredensial, dan pemetaan bucket sendiri.

## Arsitektur

```
S3 Client ──SigV4──▶ S3 Gateway (listener terpisah, path-style, XML)
                        │ verifikasi access key (s3_credentials, AES-256-GCM vault)
                        │ lookup bucket (s3_buckets → storage_account)
                        ▼
                 Connector Registry (by providers.protocol)
                 ├── s3_compatible → proxy ke MinIO/AWS/R2 (multipart passthrough)
                 └── oauth2_cloud  → Google Drive (multipart di-staging lokal)
```

- **Listener terpisah** (`S3_API_ADDR`, default `:9000`): dialek S3 (XML,
  path-style, SigV4) berbeda dari REST JSON API (`PORT`, default `:8080`),
  sehingga middleware CORS/limiter REST tidak diterapkan di gateway.
  Kosongkan `S3_API_ADDR` untuk menonaktifkan gateway.
- **Kredensial SigV4** yang diterbitkan Cloudrive tersimpan terenkripsi di
  tabel `s3_credentials` (vault yang sama dengan kredensial provider);
  secret hanya ditampilkan **sekali** saat dibuat.
- **Bucket = pemetaan**: tabel `s3_buckets` memetakan nama bucket (namespace
  global) ke satu storage account + `root_prefix` di dalamnya. Membuat/menutup
  mapping tidak pernah menyentuh data di storage account.

## Alur pemakaian

1. **Hubungkan storage account** (sudah ada): `POST /v1/storage/accounts`
   dengan `provider_slug`:
   - `s3_compatible` → `credentials`: `{"endpoint", "access_key_id",
"secret_access_key", "bucket", "secure"}` (`secure: false` untuk MinIO
     HTTP lokal; bucket bisa juga di `settings.bucket`).
   - `google_drive` → `credentials`: `{"refresh_token"}` (butuh
     `GOOGLE_CLIENT_ID/SECRET` server; folder akar via
     `settings.root_folder_id`).
2. **Terbitkan access key** untuk workspace:
   `POST /v1/workspaces/:wsId/s3/credentials` (org owner/admin). Respons
   memuat `access_key_id` + `secret_key` sekali.
3. **Buat bucket mapping**:
   `POST /v1/workspaces/:wsId/s3/buckets`
   `{"name": "my-bucket", "storage_account_id": "...", "root_prefix": "s3/"}`.
   `root_prefix` kosong berarti akar akun; jika diisi harus berakhiran `/`.
4. **Arahkan client S3** ke `http://<host>:9000` (path-style):

```bash
# aws-cli
aws configure set aws_access_key_id <AKI>
aws configure set aws_secret_access_key <SECRET>
aws --endpoint-url http://localhost:9000 s3 ls
aws --endpoint-url http://localhost:9000 s3 cp video.mp4 s3://my-bucket/media/

# rclone (remote "cloudrive")
# cloudrive] type = s3, endpoint = http://localhost:9000, path_style = true
rclone copy ./big.iso cloudrive:my-bucket/iso/
```

## Operasi yang didukung

| Operasi                                           | Status | Catatan                                                                    |
| ------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| ListBuckets                                       | ✅     | hanya bucket milik workspace kredensial                                    |
| ListObjectsV2                                     | ✅     | prefix, delimiter, continuation-token, max-keys                            |
| PutObject / GetObject / HeadObject / DeleteObject | ✅     | delete idempoten                                                           |
| Multipart (initiate/upload part/complete/abort)   | ✅     | passthrough di backend S3; staging lokal di Drive                          |
| Presigned GET/PUT                                 | ✅     | dibuat oleh client dari access key Cloudrive; verifikasi expiry di gateway |
| CreateBucket/DeleteBucket via S3 API              | ❌     | kelola lewat REST `/v1/workspaces/:wsId/s3/buckets`                        |

Body PUT yang memakai streaming signature (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD`,
dipakai aws-cli & minio-go) di-decode otomatis oleh gateway sebelum diteruskan
ke connector.

## Verifikasi SigV4

Diterapkan in-house di `internal/lib/sigv4` (verifikasi saja, tanpa state):
canonical request + presigned query, payload `UNSIGNED-PAYLOAD`, dan
`X-Amz-Expires` untuk presigned. Diuji dengan test vector resmi AWS
(`sigv4_test.go`).

## Keamanan

- Secret access key di-hash tak pernah disimpan — terenkripsi AES-256-GCM
  (`key_id` mendukung rotasi), dekripsi hanya di memori untuk verifikasi.
- Kredensial provider (akses ke backend) tetap melalui vault
  `storage_account_secrets`; gateway mem-dekripsi per request, tanpa cache.
- Bucket hanya dilayani jika akunnya berstatus `active`; kredensial `revoked`
  langsung berhenti mengautentikasi.
- `last_used_at` dicatat di setiap request terautentikasi.

## Pengujian

- Unit: vektor SigV4 AWS, decoder aws-chunked, validasi nama bucket.
- Integrasi (`internal/services/s3/gateway_test.go`): MinIO via testcontainers —
  end-to-end SigV4 → gateway → connector → MinIO, termasuk multipart 2 part
  dan penolakan signature/workspace asing. Jalankan dengan Docker tersedia:

```bash
DOCKER_HOST=unix://$HOME/.orbstack/run/docker.sock go test ./internal/services/s3/
```
