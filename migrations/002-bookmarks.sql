-- Migration 002: tabel bookmarks (bookmark artikel milik user yang login).
-- Engine/charset disesuaikan dengan tabel existing (users/posts/categories):
-- InnoDB, utf8mb4, utf8mb4_0900_ai_ci.
-- Project tidak memiliki migration runner otomatis, jalankan sekali secara manual:
--   mysql -u root db_blog_app < migrations/002-bookmarks.sql
-- Aman dijalankan ulang: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS bookmarks (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_bookmarks_user_post UNIQUE (user_id, post_id),
  CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_bookmarks_post FOREIGN KEY (post_id) REFERENCES posts (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
