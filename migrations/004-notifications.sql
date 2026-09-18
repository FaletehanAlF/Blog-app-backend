-- Migration 004: tabel notifications (notifikasi aktivitas pada artikel).
-- Engine/charset disesuaikan dengan tabel existing (users/posts/categories/bookmarks/likes):
-- InnoDB, utf8mb4, utf8mb4_0900_ai_ci.
-- Project tidak memiliki migration runner otomatis, jalankan sekali secara manual:
--   mysql -u root db_blog_app < migrations/004-notifications.sql
-- Aman dijalankan ulang: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS notifications (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  actor_user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  post_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_is_read (user_id, is_read),
  KEY idx_notifications_user_created_at (user_id, created_at),
  KEY idx_notifications_post_id (post_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor_user FOREIGN KEY (actor_user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_notifications_post FOREIGN KEY (post_id) REFERENCES posts (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

