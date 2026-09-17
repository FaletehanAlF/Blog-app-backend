-- Migration 001: ownership kategori (categories.user_id) + FK aman
-- Aman untuk data existing: tidak ada DELETE, hanya backfill NULL.
-- Jalankan sekali: mysql -u root db_blog_app < migrations/001-category-ownership.sql

-- 1. Backfill kategori lama yang belum punya owner ke admin pertama.
--    Fallback ke user pertama jika belum ada admin.
UPDATE categories
SET user_id = (
  SELECT id FROM (
    SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1
  ) AS admin_user
)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM users WHERE role = 'admin');

UPDATE categories
SET user_id = (
  SELECT id FROM (
    SELECT id FROM users ORDER BY id LIMIT 1
  ) AS first_user
)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM users);

-- 2. Backfill artikel lama yang belum punya owner (agar JOIN author konsisten).
UPDATE posts
SET user_id = (
  SELECT id FROM (
    SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1
  ) AS admin_user
)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM users WHERE role = 'admin');

UPDATE posts
SET user_id = (
  SELECT id FROM (
    SELECT id FROM users ORDER BY id LIMIT 1
  ) AS first_user
)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM users);

-- 3. Foreign key categories.user_id -> users.id (aman: kolom nullable, SET NULL saat user dihapus).
--    Lewati jika constraint sudah ada (cek INFORMATION_SCHEMA terlebih dahulu).
ALTER TABLE categories
  ADD CONSTRAINT fk_categories_user
  FOREIGN KEY (user_id) REFERENCES users (id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

-- 4. Foreign key posts.user_id -> users.id (posts_ibfk_1 untuk category_id tetap dipertahankan).
ALTER TABLE posts
  ADD CONSTRAINT fk_posts_user
  FOREIGN KEY (user_id) REFERENCES users (id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;
