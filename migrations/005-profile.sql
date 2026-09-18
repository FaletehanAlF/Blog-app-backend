-- Migration 005: tambahkan kolom profile_image ke tabel users.
-- Aman untuk data existing: tidak ada DELETE, tidak ada perubahan data.
-- Jalankan sekali: mysql -u root db_blog_app < migrations/005-profile.sql

ALTER TABLE users
ADD COLUMN profile_image VARCHAR(255) NULL DEFAULT NULL AFTER role;
