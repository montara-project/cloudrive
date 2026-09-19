# Implementasi Authula di apps/server — full user account & session management

## Temuan (kenapa ini bukan proyek dari nol)

Authula v1.46.0 **sudah** menjadi dependency langsung (`go.mod`) dan wiring plugin-nya **sudah lengkap** di `cmd/api/authula.go`: session, email via Resend, email & password, magic link, OAuth2 Google + route mappings + callback email ke template `templates/emails/*.html`. Yang belum: **tidak ada yang memanggilnya** — `newAuthula()` tidak pernah dipanggil, handler tidak di-mount, middleware tidak diregistrasi, `migrations/` kosong.

Verifikasi terhadap source module (v1.46.0) mengkonfirmasi semua yang dibutuhkan: adapter Fiber (`adapters/fiber`, `fiberadapter.New(Config{Handler})`), `AuthConfig.DB` (`bun.IDB`), hooks `RegisterAfterCreate/AfterUpdate`, endpoint magic link (`POST /magic-link/sign-in`, `GET /verify`, `POST /exchange`) cocok dengan route mappings yang ada, migrasi Authula berjalan otomatis di `authula.New()`, `SecurityConfig.TrustedProxies` tersedia, dan `User.ID` Authula berformat UUID v4 (kompatibel dengan `lib.ContextSetUID`).

Keputusan arsitektur (karena pertanyaan tidak terjawab, mengikuti scaffolding yang ada): **mirror tabel users** — Authula tetap satu-satunya yang mengelola sign-up/sign-in/sesi, tiap user Authula disinkronkan ke tabel `users` milik aplikasi via service hooks (`splitName` yang sudah ada ikut terpakai).

## Perubahan

### 1. Sambungkan Authula — `cmd/api/main.go`
- Setelah `connectDB`: `authulaDB, err := newAuthula(cfg)` (+ defer close koneksi underlying-nya).
- Setelah `application` dibangun (butuh Logger/Services): `application.Auth = newAuthula(application, authulaDB)`. Migrasi Authula berjalan otomatis di sini (core + plugin tables di schema `authula`).

### 2. Mount handler — `cmd/api/routes.go`
- `r.Use(authBasePath, fiberadapter.New(fiberadapter.Config{Handler: app.Auth.Handler()}))`.
- Adapter meneruskan path apa adanya dan Authula mendaftarkan route dengan BasePath-nya sendiri, jadi mount prefix `/v1/auth` harus persis sama dengan `authBasePath`.

### 3. Middleware Authorization — `internal/middlewares/authorization.go`
- Setelah sesi tervalidasi, parse `session.UserID` → `lib.ContextSetUID(c, uid)` agar handler aplikasi bisa memakai `lib.ContextGetUID`.
- Registrasi **per-route** (bukan global, agar `/` dan `/health` tetap terbuka).

### 4. Mirror tabel users
- Migrasi `migrations/000001_create_users.{up,down}.sql`: `id uuid pk`, `email unique`, `first_name`, `last_name nullable`, `image nullable`, `created_at`, `updated_at`.
- `internal/models/user.go` + `internal/repositories/user.go` (mengikuti pola `BaseRepository` yang ada).
- Hooks di `newAuthula`: `RegisterAfterCreate` → insert; `RegisterAfterUpdate` → update (pakai `splitName`).
- Handler `GET /v1/me` terproteksi middleware Authorization → profil user dari repositori (demonstrasi rantai penuh: cookie sesi Authula → validasi → uid → data user aplikasi).

### 5. Polish kecil
- `WithSecurity(...)`: isi `TrustedProxies: cfg.App.TrustedProxies` (sekarang kosong padahal flag-nya ada).
- `services/email.go`: From name pakai `cfg.App.Name` (sekarang hardcode `"GoFi"`).
- `.env.example`: tambah `APP_DEFAULT_PASS=` (dipakai target Makefile `db/migrations/*` tapi belum ada di contoh).

## Verifikasi
- `go build ./...` + `go vet ./...`.
- Jika Postgres lokal tersedia: `make db/migrations/up` lalu `make run`, smoke test: `/health` 200, `GET /v1/auth/me` 401 tanpa sesi, `POST /v1/auth/email-password/sign-up` (path validasi), alur OAuth Google tinggal diarahkan ke `SERVER_URL + /v1/auth/oauth2/authorize/google`.

Catatan: `RequireEmailVerification: true` sudah dikonfigurasi — sign-in diblokir sampai email diverifikasi, jadi `RESEND_API_KEY` wajib terisi saat testing.
