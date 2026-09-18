-- Migration 007: password_reset_tokens untuk fitur Forgot / Reset Password
-- Aman untuk data existing: hanya CREATE TABLE baru, tidak mengubah tabel users.
-- Jangan auto-run. Jalankan manual sekali:
--   mysql -u root db_blog_app < migrations/007-password-reset.sql
-- Idempotent: gunakan IF NOT EXISTS agar aman dijalankan ulang (MySQL 8.0+ / MariaDB).

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  INDEX idx_password_reset_token_hash (token_hash),
  INDEX idx_password_reset_user_id (user_id),
  INDEX idx_password_reset_expires_at (expires_at)
) ENGINE=InnoDB;
