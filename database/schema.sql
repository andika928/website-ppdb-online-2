-- Pilih database ppdb di phpMyAdmin sebelum mengimpor file ini.
-- Skema saja: tidak menghapus tabel atau memasukkan password bawaan.
CREATE TABLE IF NOT EXISTS admins (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'operator',
  approved TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(64) PRIMARY KEY, admin_id INT NOT NULL, csrf VARCHAR(48) NOT NULL,
  expires BIGINT NOT NULL, INDEX idx_sessions_expires(expires),
  FOREIGN KEY (admin_id) REFERENCES admins(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(48) PRIMARY KEY, nisn VARCHAR(10) NOT NULL, year VARCHAR(9) NOT NULL,
  secret VARCHAR(64) NOT NULL, data LONGTEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Menunggu verifikasi',
  note VARCHAR(1000) NOT NULL DEFAULT '', created VARCHAR(30) NOT NULL,
  UNIQUE KEY uq_applications_nisn_year(nisn,year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(48) PRIMARY KEY, application_id VARCHAR(48) NOT NULL,
  kind VARCHAR(40) NOT NULL, mime VARCHAR(100) NOT NULL, content MEDIUMBLOB NOT NULL,
  UNIQUE KEY uq_documents_kind(application_id,kind),
  FOREIGN KEY (application_id) REFERENCES applications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS settings (id INT PRIMARY KEY, data LONGTEXT NOT NULL)
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS audit (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, actor VARCHAR(150) NOT NULL,
  action TEXT NOT NULL, created VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS result_publications (
  year VARCHAR(9) PRIMARY KEY, published TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS school_profile (id INT PRIMARY KEY, data LONGTEXT NOT NULL)
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS school_posts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, type VARCHAR(30) NOT NULL,
  title VARCHAR(160) NOT NULL, summary TEXT NOT NULL, content LONGTEXT NOT NULL,
  image VARCHAR(255) NOT NULL, event_date VARCHAR(10) NOT NULL DEFAULT '',
  published TINYINT NOT NULL DEFAULT 0, created VARCHAR(30) NOT NULL, updated VARCHAR(30) NOT NULL,
  INDEX idx_school_posts_public(published,type,created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
