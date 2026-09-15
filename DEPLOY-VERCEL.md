# Deployment PPDB ke Vercel

## Arsitektur

- Frontend HTML/CSS/JS dan foto sekolah dibangun ke `public/` oleh `scripts/build-vercel.js`.
- Hanya folder publik yang disajikan sebagai file statis; `server.js`, `.env`, database, dan backup tidak termasuk.
- `/api/*` diarahkan ke `api/index.js`, yang menggunakan backend Node.js serta pool MySQL.
- Tanpa konfigurasi MySQL online, API memberikan HTTP 503 dan pendaftaran/login belum aktif. Halaman profil statis dapat dibuka, tetapi konten CMS dinamis menunggu database.
- `.vercelignore` mencegah file `.env`, data siswa, backup, serta profil browser masuk unggahan deployment.

## Deploy

1. Login: `npx vercel login`.
2. Deploy dari folder proyek: `npx vercel --prod`.
3. Pilih akun dan nama proyek. Preset Other, build command dan output sudah diatur di `vercel.json`.
4. Jangan mengunggah `.env` atau memasukkan password ke Git. `.env.example` hanya contoh lokal.

## Mengaktifkan fitur PPDB

MySQL XAMPP pada `127.0.0.1` tidak dapat dijangkau dari Vercel. Siapkan layanan MySQL/MariaDB online dengan TLS dan akses jaringan yang sesuai. Jangan membuka root MySQL lokal ke internet.

Isi variabel berikut melalui Project Settings → Environment Variables untuk environment yang akan digunakan:

| Variabel | Nilai |
| --- | --- |
| `DB_HOST` | Host MySQL online |
| `DB_PORT` | Port dari penyedia |
| `DB_NAME` | Nama database |
| `DB_USER` | Akun khusus aplikasi |
| `DB_PASSWORD` | Password database; simpan sebagai secret |
| `DB_SSL` | `true` untuk TLS |
| `DB_SSL_CA` | Sertifikat CA jika penyedia memerlukannya; opsional |
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | URL HTTPS utama, tanpa slash di akhir |

Sertifikat TLS harus valid. Aplikasi tidak menonaktifkan verifikasi sertifikat. Jika APP_ORIGIN menunjuk domain produksi, akses formulir melalui domain tersebut; preview dengan domain lain perlu origin tersendiri dan database uji.

Impor `database/schema.sql` ke database online yang dituju dan pastikan `max_allowed_packet` minimal 4 MB (16 MB disarankan). Backend saat ini melakukan inisialisasi tabel/default saat cold start; akun aplikasi memerlukan hak CREATE serta SELECT/INSERT/UPDATE/DELETE pada database ini.

Untuk memindahkan data MySQL lokal, lakukan dump/restore terpisah ke penyedia yang dipilih setelah memastikan tujuan dan izin pemindahan data siswa. Deployment source code tidak memindahkan database otomatis. Akun admin lama hanya ada di cloud jika data akun dimigrasikan; untuk database kosong buat admin dengan perintah CLI lokal menggunakan koneksi database online.

Redeploy setelah konfigurasi berubah. Periksa `/api/health`, login, pendaftaran, unggahan 2 MB dan hasil seleksi sebelum menerima pendaftar nyata.

## Batas operasional

Rate limit aplikasi masih per instance Node.js, sehingga bukan pembatasan global pada semua instance Vercel. Tambahkan aturan WAF/rate limit yang sesuai sebelum layanan dibuka ke publik. Sesi, dokumen, dan data pendaftaran tetap persisten di MySQL. Jangan memakai database produksi untuk pengujian otomatis; tes memerlukan hak membuat dan menghapus database sementara.

Referensi: [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js), [konfigurasi Vercel](https://vercel.com/docs/project-configuration/vercel-json), [connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions).
