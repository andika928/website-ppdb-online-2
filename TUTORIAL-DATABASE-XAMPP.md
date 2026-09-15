# Tutorial PPDB dengan MySQL XAMPP

Backend sekarang memakai MySQL/MariaDB melalui `mysql2`. SQLite hanya dibaca oleh skrip migrasi. Apache digunakan untuk phpMyAdmin; website tetap dijalankan oleh Node.js.

## Status pada komputer ini

- MariaDB XAMPP 10.4.32 tersedia pada `127.0.0.1:3306`, database `ppdb`.
- Data lama sudah dipindahkan: 2 akun panitia, 1 pendaftar, 3 dokumen, 12 catatan audit, pengaturan, profil sekolah, dan publikasi hasil.
- Password dan kode siswa tetap berlaku. Sesi lama tidak dipindah: login kembali.
- Snapshot SQLite sebelum migrasi tersedia di `data/backups/`. File sumber dipertahankan.
- Batas paket MySQL diubah dari 1 MB menjadi 16 MB untuk mendukung unggahan 2 MB. Salinan konfigurasi lama: `data/xampp-my-before-ppdb.ini`.
- Jangan mengulangi migrasi ke `ppdb` yang sudah berisi data; skrip akan menolaknya.

## 1. Persiapan pada komputer baru

1. Instal Node.js 24 atau lebih baru dan XAMPP Windows.
2. Buka XAMPP Control Panel; Start **MySQL** dan **Apache**.
3. Klik **Config → my.ini** pada MySQL. Pada bagian `[mysqld]` atur:

```ini
max_allowed_packet=16M
```

4. Simpan lalu Stop/Start MySQL. Mengubah bagian `[mysqldump]` saja tidak cukup.
5. Buka PowerShell:

```powershell
Set-Location C:\website-ppdb
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Sesuaikan `.env`:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ppdb
DB_USER=root
DB_PASSWORD=
HOST=127.0.0.1
PORT=3000
```

Contoh root tanpa password hanya berlaku jika instalasi lokal memang memakai kredensial tersebut. Jika ada password, isi dengan benar. Password mengandung `#` perlu diapit tanda kutip. Environment terminal mengungguli `.env`. Jangan membagikan file ini atau memasukkannya ke Git.

## 2. Membuat database dan memasukkan skema

Cara terminal:

```powershell
npm run db:setup
```

Setup membuat database dan 9 tabel InnoDB tanpa menghapus data. Akun database memerlukan hak CREATE. Tidak ada akun panitia/password bawaan.

Alternatif melalui phpMyAdmin:

1. Buka `http://localhost/phpmyadmin/`.
2. Buka tab SQL dan jalankan:

```sql
CREATE DATABASE IF NOT EXISTS ppdb
  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
```

3. Klik **ppdb** di sidebar → **Import → Choose File**.
4. Pilih **`C:\website-ppdb\database\schema.sql`**, format SQL, lalu Import/Kirim.
5. Pastikan tabel `admins`, `sessions`, `applications`, `documents`, `settings`, `audit`, `result_publications`, `school_profile`, dan `school_posts` muncul.

File ini berisi struktur saja. Jangan mengimpor `.sqlite`, `.sqlite-shm`, atau `.sqlite-wal` melalui phpMyAdmin.

## 3. Migrasi data lama ATAU instalasi kosong

### A. Memindahkan SQLite

Lakukan sebelum menjalankan server MySQL atau membuat admin. Hentikan server PPDB lama dan baru selama migrasi. Database tujuan harus kosong, termasuk tabel pengaturan/profil. Jangan menjalankan dua migrasi bersamaan.

```powershell
npm run db:migrate
```

Sumber bawaan adalah `data/ppdb.sqlite`. Lokasi lain:

```powershell
npm run db:migrate -- "D:\cadangan-ppdb\ppdb.sqlite"
```

Skrip membuat snapshot dengan API backup SQLite, termasuk perubahan WAL yang sudah committed. Seluruh data disalin dalam satu transaksi; setiap nilai, hash dan byte dokumen diperiksa sebelum commit. Jika gagal, data impor di-rollback; struktur tabel hasil setup bisa tetap ada. Sumber tidak dihapus. Sesi login lama tidak disalin.

Jika tujuan tidak kosong, gunakan `DB_NAME` baru, misalnya `ppdb_migrasi`, lalu setup dan migrasi. Jangan menghapus tabel aktif. Backup SQLite berupa salinan file harus diambil saat server berhenti; sertakan WAL terkait jika masih ada. Salinan file utama saja saat server aktif dapat kehilangan data terbaru.

### B. Instalasi kosong tanpa data lama

Lewati migrasi dan buat superadmin:

```powershell
$env:ADMIN_NAME = 'Panitia PPDB'
$env:ADMIN_EMAIL = 'panitia@sekolah.sch.id'
$ppdbSecret = Read-Host 'Password minimal 12 karakter' -AsSecureString
try {
    $env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $ppdbSecret).Password
    npm run admin:create
} finally {
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable ppdbSecret -ErrorAction SilentlyContinue
}
```

Ganti nama/email sesuai panitia. Setelah migrasi, gunakan akun lama; tidak perlu membuat akun ulang. Perintah ini bukan reset password.

## 4. Menjalankan website

```powershell
npm start
```

Biarkan terminal terbuka, kemudian buka:

- Website: http://127.0.0.1:3000/
- Siswa: http://127.0.0.1:3000/ppdb
- Panitia: http://127.0.0.1:3000/admin
- Health: http://127.0.0.1:3000/api/health

Health memeriksa query database dan mengembalikan `{"service":"st-yoseph-ppdb","version":1}` jika berhasil. Proyek tidak harus berada di `htdocs`. Klik ganda HTML dan Live Server tidak menjalankan backend.

## 5. Pengaturan dan pengujian alur

1. Login superadmin, isi tahun ajaran, jadwal WITA, persyaratan, kontak/biaya resmi, dan buka pendaftaran.
2. Pada database khusus uji, daftarkan siswa dengan NISN 10 digit. NISN unik per tahun ajaran.
3. Simpan nomor pendaftaran dan kode akses. Kode asli tidak dapat diambil kembali dari database.
4. Unggah kartu keluarga, akta kelahiran, dan rapor, masing-masing PDF/JPG/PNG maksimal 2 MB.
5. Periksa biodata, unduh dokumen, uji Perlu perbaikan dan Terverifikasi.
6. Akun operator baru harus disetujui superadmin; operator memverifikasi, superadmin menetapkan seleksi.
7. Tetapkan hasil. Siswa melihat Seleksi berlangsung sampai hasil untuk tahun tersebut diterbitkan.
8. Aktifkan publikasi hasil dan periksa melalui portal siswa. Uji filter, ekspor CSV, profil, dan CMS sekolah.
9. Restart Node.js dan periksa bahwa data tetap tersedia.

```powershell
npm test
```

Tes memerlukan MySQL aktif serta akun dengan hak CREATE/DROP database. Tes membuat database acak `ppdb_test_*` dan menghapus hanya database buatannya sendiri. Data sekolah tidak dipakai sebagai fixture. Cakupan termasuk otorisasi, CSRF, CMS, publikasi per tahun, dokumen 2 MB, transaksi bersamaan, migrasi berhasil, dan rollback migrasi gagal.

## 6. Backup MySQL

Database aktif kini di MariaDB; file SQLite lama tidak berisi pendaftaran baru.

Melalui phpMyAdmin: hentikan sementara server PPDB, pilih database → Export → Custom → SQL, pilih seluruh tabel beserta struktur/data dan opsi heksadesimal untuk data biner bila tersedia. Simpan di lokasi terbatas, lalu jalankan server kembali.

Alternatif dump transaksional dari PowerShell:

```powershell
New-Item -ItemType Directory -Force .\data\backups | Out-Null
& C:\xampp\mysql\bin\mysqldump.exe --host=127.0.0.1 --user=root -p --single-transaction --hex-blob --default-character-set=utf8mb4 --result-file=C:\website-ppdb\data\backups\ppdb-backup.sql ppdb
```

Masukkan password saat diminta; Enter hanya jika akun memang tanpa password. Gunakan nama berkas baru pada setiap backup. Uji pemulihan ke database baru sebelum mengganti `DB_NAME`. Ekspor CSV pendaftar bukan backup lengkap.

## 7. Mengatasi masalah

| Pesan | Tindakan |
| --- | --- |
| `ECONNREFUSED` | Jalankan MySQL XAMPP, periksa host/port. |
| `ER_ACCESS_DENIED_ERROR` | Periksa akun database/password; akun ini berbeda dari akun panitia. |
| `ER_BAD_DB_ERROR` | Jalankan setup atau buat database di phpMyAdmin. |
| Batas paket terlalu kecil | Set `max_allowed_packet=16M` pada `[mysqld]`, restart MySQL dan Node.js. |
| `#1064` saat impor SQLite | Impor `database/schema.sql`; gunakan skrip migrasi untuk data SQLite. |
| Tujuan tidak kosong | Gunakan database baru untuk migrasi, jangan menimpa data aktif. |
| `EADDRINUSE` | Hentikan server PPDB lama atau ubah PORT. |
| Login gagal | Periksa password, persetujuan operator, dan DB_NAME; login kembali setelah migrasi. |
| Pendaftaran ditutup | Periksa jadwal WITA serta sakelar buka pendaftaran. |
| Respons bukan JSON | Buka website melalui Node.js pada port yang benar. |

Penggunaan publik memerlukan akun database khusus, HTTPS, `NODE_ENV=production` dan `APP_ORIGIN` sesuai domain. XAMPP lokal tidak dipublikasikan otomatis.

Referensi: [XAMPP](https://www.apachefriends.org/faq_windows.html), [phpMyAdmin](https://docs.phpmyadmin.net/en/master/import_export.html), [mysql2](https://sidorares.github.io/node-mysql2/docs), [MariaDB MEDIUMBLOB](https://mariadb.com/docs/server/reference/data-types/string-data-types/mediumblob).
