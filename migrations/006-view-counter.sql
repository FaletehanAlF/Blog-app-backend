-- Migration 006: tambahkan kolom view_count ke tabel posts.
-- Aman untuk data existing: tidak ada DELETE, tidak ada perubahan data selain penambahan kolom.
-- Semua baris existing otomatis mendapat view_count = 0 via DEFAULT 0 (NOT NULL).
-- Project tidak memiliki migration runner otomatis, jalankan sekali secara manual:
--   mysql -u root db_blog_app < migrations/006-view-counter.sql
-- Idempotent: aman dijalankan ulang (IF NOT EXISTS, didukung MySQL 8.0+).

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0 AFTER image;
