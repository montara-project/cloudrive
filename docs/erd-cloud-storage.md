# ERD — Cloud Storage Multi-Provider (Cloudrive)

> Status: **Desain (v1)** — belum menjadi migrasi. Mengacu pada skill `postgres-best-practices`
> (schema `public`, `text` + CHECK, `timestamptz`, index di setiap kolom FK, composite FK, JSONB
> untuk metadata tanpa integritas FK).

## 1. Konteks & tujuan

- Satu **Organization** (tenant utama) berisi beberapa **Workspace** (skema tenant sudah ada di migrasi `000003`).
- Setiap **Workspace** adalah satu "storage management": pengguna bisa menghubungkan **beberapa provider**
  (Google Drive, OneDrive, Dropbox, S3-compatible, dst) dan **beberapa akun per provider**
  (mis. 2 akun Google berbeda) ke workspace yang sama.
- **Zero-copy**: file milik provider **tidak diduplikasi** — yang disimpan adalah metadata/indeksnya
  (nama, struktur folder, ukuran, versi, permission). Penulisan data fisik hanya untuk upload eksplisit/cache.
- Semua tabel bertenant membawa `organization_id` + composite FK ke `workspaces(id, organization_id)`
  mengikuti pola `000003` → siap RLS di kemudian hari.

## 2. Keputusan desain

1. **`providers` = katalog tipe provider** (global, tidak bertenant): `google_drive`, `onedrive`,
   `dropbox`, `s3_compatible`, dst. Menyuplai keputusan konektor (protokol/auth) dan kapabilitas
   (versi, trash, ukuran maksimum) lewat kolom + JSONB.
2. **`storage_accounts` = akun provider yang terkoneksi** — inilah "1 provider bisa beberapa akun":
   satu baris per (workspace, provider, akun-eksternal). Kredensialnya (token OAuth / access key)
   dipisah ke `storage_account_secrets` (1:1, terenkripsi, `key_id` untuk rotasi kunci).
   **Akun terikat langsung ke satu workspace** (keputusan desain; pool akun level organization
   dapat menyusul belakangan) dan mencatat user yang memberi otorisasi (`owner_user_id`).
3. **Folder root per akun** (keputusan desain): saat akun menjadi `active`, dibuat satu node
   mount-root di `storage_nodes` — `source_id` = akun tersebut, `remote_id` NULL, `parent_id` NULL.
   Seluruh isi provider diindeks di bawah node ini, sehingga drive workspace tampak seperti
   `/Google - Kerja/…`, `/Google - Pribadi/…`, `/Dropbox/…`. Node **native Cloudrive**
   (folder/file buatan aplikasi, bukan mirror provider) memiliki `source_id` NULL.
4. **`storage_nodes` = satu pohon file/folder terpadu per workspace** ("single drive"):
   folder & file dalam satu tabel self-referencing (`parent_id`). Node milik provider ikut terhapus
   (`ON DELETE CASCADE`) saat akun diputus — sesuai janji produk "disconnecting a Source removes its index".
5. **`storage_node_versions` = timeline versi terpadu** lintas provider; versi native provider
   diidentifikasi `source_version_id`.
6. **`shares`** = berbagi (link publik / dalam-organization) dengan token, password opsional, kedaluwarsa.
7. **`sync_jobs`** = status sinkronisasi per akun (full scan / incremental dengan `cursor` JSONB).
8. **`upload_sessions`** = sesi upload eksplisit (satu-satunya alur yang menulis data fisik).

## 3. Diagram (Mermaid)

```mermaid
erDiagram
    organizations ||--o{ workspaces : "memiliki"
    users ||--o{ organization_members : "bergabung"
    organizations ||--o{ organization_members : "berisi"

    workspaces ||--o{ storage_accounts : "menghubungkan"
    providers ||--o{ storage_accounts : "katalog"
    users ||--o{ storage_accounts : "memberi otorisasi"
    storage_accounts ||--|| storage_account_secrets : "kredensial"
    storage_accounts ||--o{ storage_nodes : "mengindeks"
    storage_accounts ||--o{ sync_jobs : "dijalankan"
    storage_accounts ||--o{ upload_sessions : "tujuan tulis"

    workspaces ||--o{ storage_nodes : "pohon drive"
    storage_nodes ||--o{ storage_nodes : "parent_id"
    storage_nodes ||--o{ storage_node_versions : "riwayat versi"
    storage_nodes ||--o{ shares : "dibagikan"
    workspaces ||--o{ shares : "cakupan"
    storage_nodes |o--o{ upload_sessions : "node tujuan"

    providers {
        uuid id PK
        text slug UK "google_drive, onedrive, dropbox, s3_compatible"
        text name
        text protocol "oauth2_cloud | s3_compatible | webdav | ftp"
        text auth_type "oauth2 | access_key | password"
        jsonb capabilities "versioning, trash, max_file_size, native_search"
        boolean is_active "default true"
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    storage_accounts {
        uuid id PK
        uuid organization_id FK
        uuid workspace_id FK "composite FK (workspace_id, organization_id)"
        uuid provider_id FK "ON DELETE RESTRICT"
        uuid owner_user_id FK "user yang memberi consent"
        text display_name "label bebas, mis. 'Google - Kerja'"
        text account_email "email akun di provider, opsional"
        text external_account_id "ID akun sisi provider"
        jsonb settings "endpoint override, root_path, quota"
        text status "pending_auth | active | expired | revoked | error"
        timestamptz last_synced_at
        timestamptz deleted_at "soft delete = disconnect"
        timestamptz created_at
        timestamptz updated_at
    }

    storage_account_secrets {
        uuid storage_account_id PK_FK "ON DELETE CASCADE"
        text credentials_encrypted "AES-256-GCM: key_id:base64(nonce):base64(ciphertext)"
        text key_id "versi kunci enkripsi, untuk rotasi"
        timestamptz updated_at
    }

    storage_nodes {
        uuid id PK
        uuid organization_id FK
        uuid workspace_id FK "composite FK (workspace_id, organization_id)"
        uuid source_id FK "NULL = native Cloudrive; CASCADE saat akun diputus"
        uuid parent_id FK "NULL = root; self-reference CASCADE"
        text node_type "folder | file"
        text name
        text mime_type
        bigint size_bytes
        text content_hash "untuk dedup"
        text remote_id "ID objek di provider; NULL pada mount-root & node native"
        timestamptz remote_updated_at "waktu sisi provider"
        timestamptz trashed_at "NULL = tidak di trash"
        jsonb metadata "etag, drive_id, native_url, dll"
        timestamptz created_at
        timestamptz updated_at
    }

    storage_node_versions {
        uuid id PK
        uuid organization_id FK
        uuid workspace_id FK
        uuid node_id FK "composite FK (node_id, organization_id, workspace_id)"
        text source_version_id "ID versi sisi provider"
        bigint size_bytes
        text content_hash
        timestamptz modified_at "waktu versi dibuat di provider"
        jsonb metadata
        timestamptz created_at
    }

    shares {
        uuid id PK
        uuid organization_id FK
        uuid workspace_id FK
        uuid node_id FK "ON DELETE CASCADE"
        uuid shared_by FK
        text access "public_link | organization"
        text permission "view | edit"
        text token UK "secret link"
        text password_hash "opsional"
        timestamptz expires_at "opsional"
        timestamptz revoked_at "opsional"
        timestamptz created_at
        timestamptz updated_at
    }

    sync_jobs {
        uuid id PK
        uuid organization_id FK
        uuid workspace_id FK
        uuid storage_account_id FK "ON DELETE CASCADE"
        text job_type "full_scan | incremental | upload | download | delete_propagation"
        text status "queued | running | succeeded | failed | cancelled"
        jsonb cursor "delta/page token untuk incremental"
        int attempts "default 0"
        text error
        timestamptz started_at
        timestamptz finished_at
        timestamptz created_at
        timestamptz updated_at
    }

    upload_sessions {
        uuid id PK
        uuid organization_id FK
        uuid workspace_id FK
        uuid storage_account_id FK "ON DELETE CASCADE"
        uuid parent_node_id FK "folder tujuan, ON DELETE CASCADE"
        text name "nama file baru"
        bigint size_bytes
        text content_hash
        text status "pending | uploading | completed | failed | cancelled"
        bigint bytes_uploaded "default 0"
        text error
        timestamptz created_at
        timestamptz updated_at
    }
```

## 4. Spesifikasi tabel & constraint penting

### `providers` — katalog (menyempurnakan model `Provider` yang sudah ada di kode)

| Hal     | Nilai                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kunci   | `id uuid PK DEFAULT uuidv7()`                                                                                                                                      |
| Unik    | `slug`                                                                                                                                                             |
| CHECK   | `protocol IN (...)`, `auth_type IN (...)`                                                                                                                          |
| Catatan | Seeder yang ada (Google Drive, OneDrive, Dropbox) tetap valid; tabel ini akhirnya dibuat secara resmi (selama ini direferensikan kode tapi tidak pernah dimigrasi) |

### `storage_accounts` — akun provider yang terkoneksi

| Hal         | Nilai                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unik        | `(workspace_id, provider_id, external_account_id)` — satu akun eksternal tak terhubung dua kali ke workspace yang sama                 |
| FK          | composite `(workspace_id, organization_id) → workspaces` CASCADE; `provider_id → providers` RESTRICT; `owner_user_id → users` RESTRICT |
| Index       | `organization_id`, `provider_id`, `owner_user_id`                                                                                      |
| Soft delete | ya (`deleted_at` = disconnect; pekerja latar membersihkan node terindeks)                                                              |

### `storage_account_secrets`

| Hal     | Nilai                                                                                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kunci   | `storage_account_id PK` (1:1)                                                                                                                                                                                     |
| FK      | `→ storage_accounts` CASCADE                                                                                                                                                                                      |
| Isi     | `credentials_encrypted text` — AES-256-GCM, format `key_id:base64(nonce):base64(ciphertext)`; kunci 32-byte dari env `STORAGE_CREDENTIALS_KEYS` (`key_id:base64`, dipisah koma untuk rotasi; entri pertama aktif) |
| Catatan | Tabel terpisah = prinsip least-privilege (query harian tak pernah menyentuh kredensial); enkripsi/dekripsi terjadi di repository — aplikasi gagal start tanpa kunci (fail-closed); `key_id` mendukung rotasi      |

### `storage_nodes` — pohon drive terpadu

| Hal                      | Nilai                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FK                       | composite `(workspace_id, organization_id) → workspaces` CASCADE; `source_id → storage_accounts` CASCADE; `parent_id → storage_nodes(id)` CASCADE                                       |
| Unik                     | `(source_id, remote_id)` — NULL `remote_id` bebas (mount-root & node native)                                                                                                            |
| Unik (nama dalam folder) | `UNIQUE (COALESCE(source_id, uuid_zero), COALESCE(parent_id, uuid_zero), lower(name))` — bentuk finalnya saat migrasi; sensitivitas huruf besar/kecil mengikuti `capabilities` provider |
| Index                    | `(workspace_id, parent_id)` untuk navigasi pohon; `source_id`; `content_hash`; partial `WHERE trashed_at IS NOT NULL`                                                                   |
| Catatan                  | Folder = baris dengan `node_type='folder'`; tidak ada tabel `folders` terpisah. Konvensi mount-root: `source_id` terisi, `remote_id` NULL                                               |

### `storage_node_versions`

| Hal   | Nilai                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FK    | composite `(node_id, organization_id, workspace_id) → storage_nodes(id, organization_id, workspace_id)` CASCADE — butuh `UNIQUE(id, organization_id, workspace_id)` di `storage_nodes` |
| Unik  | `(node_id, source_version_id)`                                                                                                                                                         |
| Index | `(node_id, modified_at DESC)` untuk timeline versi                                                                                                                                     |

### `shares`

| Hal   | Nilai                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------- |
| FK    | composite `(workspace_id, organization_id)`; `node_id` CASCADE; `shared_by → users`                             |
| Unik  | `token`                                                                                                         |
| Index | `node_id`, `organization_id`, partial `WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())` |

### `sync_jobs`

| Hal   | Nilai                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------- |
| FK    | composite `(workspace_id, organization_id)`; `storage_account_id` CASCADE                            |
| Index | `(storage_account_id, status)`; partial `WHERE status IN ('queued','running')` untuk antrean pekerja |

### `upload_sessions`

| Hal     | Nilai                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| FK      | composite `(workspace_id, organization_id)`; `storage_account_id` CASCADE; `parent_node_id → storage_nodes` CASCADE |
| Catatan | Level detail kolom paling lentur — disesuaikan saat implementasi konektor                                           |

## 5. Alur utama (bagaimana tabel bekerja bersama)

1. **Connect account**: pilih `providers` → OAuth/credential flow → tulis `storage_accounts`
   (status `pending_auth` → `active`) + `storage_account_secrets` → buat node mount-root di `storage_nodes`.
2. **Sync**: buat `sync_jobs` (`full_scan`/`incremental`) → upsert `storage_nodes` di bawah mount-root
   - `storage_node_versions`; `cursor` disimpan untuk delta berikutnya.
3. **Browse/search**: baca `storage_nodes` per `(workspace_id, parent_id)`; pencarian bisa memakai
   kolom `tsvector` generated (`STORED`) atas `name` + `metadata->>'description'`.
4. **Share**: buat baris `shares` dengan `token` acak.
5. **Disconnect**: soft-delete `storage_accounts` → cascade menghapus node terindeks akun tersebut
   (termasuk mount-root-nya); data di provider tidak tersentuh.
6. **Upload eksplisit**: `upload_sessions` berjalan per chunk → selesai = node baru di `storage_nodes`
   - versi pertama di `storage_node_versions`.

## 6. Hubungan dengan yang sudah ada

- Pola composite FK & `organization_id` di semua tabel bertenant = kelanjutan langsung migrasi `000003`
  (hierarki `organization_members` juga menjamin hanya member org yang bisa memakai storage workspace-nya).
- Model `models.Provider` + `ProviderSeeder` yang sudah ada di kode akhirnya mendapat tabel sungguhan —
  ERD ini menaikkan tabelnya menjadi katalog yang layak; seeder tetap dipakai.
- Migrasi berikutnya (usulan): `000004_create_storage_domain_schema`.

## 7. Pertanyaan terbuka (tidak memblokir ERD, diputuskan sebelum migrasi)

1. **Trash terpadu**: tampilkan trash per akun, atau trash global workspace (`trashed_at` sudah menyiapkan global)?
2. **Dedup lintas akun** via `content_hash` (hemat kuota cache) — v1 atau belakangan?
3. **Pencarian**: full-text Postgres (`tsvector`) untuk v1, atau langsung engine terpisah (Meilisearch/Typesense)?

## 8. Implementasi terkait: S3-compatible gateway (migrasi 000005)

Cloudrive juga mengekspos dirinya sebagai **S3-compatible server** (bukan hanya
klien provider). Tabel pendukung sudah dimigrasi pada `000005_create_s3_gateway_schema`:

- `s3_credentials` — access key SigV4 yang diterbitkan Cloudrive per workspace
  (secret terenkripsi via SecretBox, sama seperti `storage_account_secrets`).
- `s3_buckets` — pemetaan nama bucket (namespace global) → `storage_accounts` +
  `root_prefix`. Bucket bukan data baru: hanya jalur ke akun yang sudah terhubung.

Desain lengkap (alur, operasi yang didukung, contoh aws-cli/rclone) ada di
`docs/s3-gateway.md`.
