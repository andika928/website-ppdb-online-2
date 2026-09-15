# SMP Katolik St. Yoseph Luwuk — PPDB Online

Portal siswa `/ppdb`, panel panitia terpisah `/admin`, dan website profil `/` menggunakan backend Node.js serta database MySQL/MariaDB XAMPP yang sama. Memerlukan Node.js 24 atau lebih baru dan paket `mysql2`. Tidak memakai API AI. Biaya server/domain, jika dipublikasikan, mengikuti penyedia hosting.

## Menjalankan

Aktifkan MySQL XAMPP, atur `max_allowed_packet=16M` di bagian `[mysqld]` pada `my.ini`, lalu restart MySQL. Jalankan `npm ci`, salin `.env.example` ke `.env` jika belum ada, dan sesuaikan koneksi database. Jalankan `npm run db:setup`.

Jika ada SQLite lama, hentikan server lama dan jalankan `npm run db:migrate` **sebelum** menjalankan server atau membuat admin. Tujuan harus kosong. Migrasi membuat snapshot, memverifikasi setiap nilai termasuk dokumen, dan menolak menimpa data. Sesi lama tidak dipindahkan; login kembali. File `database/schema.sql` dapat diimpor lewat phpMyAdmin untuk struktur tabel; jangan mengimpor file SQLite.

Jalankan `npm start` dan buka http://127.0.0.1:3000/ppdb atau http://127.0.0.1:3000/admin. Jangan gunakan Live Server/static hosting karena fitur PPDB memerlukan backend Node.js. Lihat [tutorial XAMPP lengkap](TUTORIAL-DATABASE-XAMPP.md).

## Membuat superadmin pertama

Pembuatan superadmin hanya melalui terminal server, bukan formulir publik. Di PowerShell:

```powershell
$env:ADMIN_NAME = 'Nama Panitia Utama'
$env:ADMIN_EMAIL = 'email-panitia@sekolah.sch.id'
$adminSecret = Read-Host 'Kata sandi baru (minimal 12 karakter)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecret).Password
node server.js --create-admin
Remove-Item Env:ADMIN_PASSWORD
```

Gunakan email dan kata sandi yang baru dibuat untuk login. Tidak ada kata sandi bawaan. Superadmin tambahan dapat dibuat melalui prosedur terminal yang sama dengan email berbeda.

## Alur operasional

1. Superadmin mengisi tahun ajaran, jadwal dalam WITA, persyaratan, kontak/biaya, dan membuka pendaftaran pada Pengaturan PPDB. Jadwal dan biaya resmi harus diisi sekolah; aplikasi tidak mengarang ketentuan tersebut. Jalur tersedia: Reguler, Prestasi, Afirmasi.
2. Siswa mengirim biodata. Sistem menerbitkan nomor pendaftaran dan kode akses rahasia. Simpan bukti `.txt` atau cetak segera; kode asli tidak tersimpan di database dan tidak dikirim melalui email/WhatsApp.
3. Siswa mengunggah kartu keluarga, akta kelahiran, dan rapor (PDF/JPG/PNG maksimal 2 MB per berkas). Dokumen dapat diganti selama menunggu verifikasi atau perlu perbaikan.
4. Panitia mendaftar akun melalui `/admin`. Superadmin menyetujui akun tersebut di Akun panitia. Akun operator yang belum disetujui tidak dapat login.
5. Operator memeriksa biodata dan mengunduh dokumen, lalu menetapkan status verifikasi atau perbaikan. Tiga dokumen wajib harus lengkap sebelum status terverifikasi.
6. Superadmin menetapkan Lulus, Tidak lulus, atau Cadangan. Seleksi dilakukan oleh panitia, bukan perhitungan otomatis. Aktifkan Terbitkan hasil seleksi untuk memperlihatkan keputusan; sebelumnya siswa hanya melihat Seleksi berlangsung. Pengaturan publikasi berlaku per tahun ajaran. Mengubah publikasi tahun berikutnya tidak mengubah hasil angkatan sebelumnya.
7. Siswa membuka Cek pendaftaran & hasil memakai nomor dan kode akses. Panitia dapat memfilter tahun/status, mencari pendaftar, mengekspor CSV, serta melihat daftar siswa diterima.

## Penyimpanan dan keamanan

- MySQL/MariaDB persisten: database sesuai `DB_NAME` (bawaan `ppdb`), termasuk dokumen siswa sebagai `MEDIUMBLOB`. Gunakan dump SQL lengkap dengan data biner, misalnya `mysqldump --single-transaction --hex-blob`. Uji restore ke database terpisah. Folder `data` menyimpan backup SQLite lama, bukan data aktif setelah migrasi; folder itu tidak disajikan melalui HTTP dan diabaikan Git. `.env` juga diabaikan Git.
- Password di-hash menggunakan scrypt dengan salt acak. Kode siswa dan token sesi disimpan sebagai hash SHA-256. Cookie admin HttpOnly dan SameSite Strict, sesi 8 jam, pemeriksaan CSRF serta origin, otorisasi server untuk setiap endpoint admin, pembatasan percobaan per IP, validasi input, prepared SQL statements, dan audit perubahan admin.
- Operator hanya memverifikasi. Superadmin mengatur seleksi/publikasi dan akses akun. Penonaktifan akun langsung mencabut sesinya.
- Tidak ada reset kata sandi lewat email atau pemulihan kode siswa otomatis. Pemulihan harus melalui pengelola server setelah verifikasi identitas; jangan memberikan database kepada siswa.
- Dokumen diperiksa ukuran dan signature file, bukan dipindai antivirus. Unduhan hanya untuk panitia yang login.
- Sebelum penggunaan publik: pasang HTTPS melalui reverse proxy, set `NODE_ENV=production` dan `APP_ORIGIN=https://domain-sekolah`, lalu arahkan proxy ke server. `HOST` bawaan `127.0.0.1`, `PORT` bawaan `3000`; koneksi diatur melalui `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD`. Gunakan akun database khusus serta penyimpanan MariaDB persisten. Tidak disebarkan ke internet secara otomatis. Rate limit menggunakan IP koneksi dan tidak mempercayai X-Forwarded-For; untuk banyak pengguna di belakang proxy, konfigurasi pembatasan tambahan pada proxy dan sesuaikan batas aplikasi.
- Sekolah perlu menetapkan kebijakan privasi, retensi, backup, serta proses verifikasi dokumen sebelum menerima data siswa nyata.

## Pemeriksaan

`npm test` memerlukan MySQL aktif dan hak CREATE/DROP database untuk akun pengujian. Tes membuat database acak `ppdb_test_*` lalu membersihkannya, tanpa mengubah data sekolah. Cakupan: pendaftaran sampai kelulusan, duplikasi NISN, unggahan dan unduhan 2 MB, larangan akses anonim/operator, CSRF, origin, publikasi hasil, pencabutan sesi, perlindungan file server, migrasi SQLite termasuk WAL, rollback saat migrasi gagal, serta isolasi transaksi bersamaan.

Website profil, foto sekolah, dan salinan `index.before-school.html` tetap dipertahankan.

## Revisi desain dan pengelolaan website

Desain diadaptasi dari https://education.dimedia.my.id/: palet biru #1b58b5 dan merah #dd3333, banner foto sekolah, pintasan layanan, sambutan sekolah, kartu berita, agenda, pengumuman, dan galeri. Konten/foto sekolah asli tetap dipakai; tidak menyalin identitas, statistik, atau berita sekolah referensi. Halaman diimplementasikan ulang dalam HTML/CSS/JavaScript dan Node.js tanpa WordPress atau API AI.

- Beranda: / — foto utama, sambutan dan kontak diambil dari database.
- Publikasi: /publikasi, filter ?type=Berita, ?type=Agenda, ?type=Pengumuman; detail ?id=ID.
- Superadmin: menu Website sekolah untuk mengedit profil dan membuat/mengedit berita, agenda, serta pengumuman. Operator tidak memperoleh akses pengelolaan CMS.
- Centang Terbitkan untuk menampilkan publikasi. Lepas centang untuk mengembalikannya ke draf; draf tidak dapat dibaca lewat API publik, termasuk dengan menebak ID. Tidak ada penghapusan permanen melalui CMS.
- Agenda memerlukan tanggal kegiatan yang valid. Beranda menampilkan agenda mendatang dalam WITA; arsip tetap tersedia melalui halaman publikasi.
- Foto dipilih dari aset sekolah yang tersedia. Isi publikasi berupa teks biasa dan ditampilkan dengan escaping; HTML dari editor tidak dieksekusi.
- Tabel school_profile, school_posts, dan result_publications ditambahkan tanpa menghapus data PPDB lama. Migrasi pertama menjaga status publikasi tahun yang sudah ada.
- Tema baru digunakan pada portal siswa, login panitia, dan dashboard. UI tetap berbahasa Indonesia.
- Pengujian mencakup CMS, draf, pembatasan peran, validasi agenda, dan isolasi publikasi hasil antar tahun.
# website-ppdb-online
# website-ppdb-online
