import { Router } from "express";
import db from "../config/database.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// GET /statistics — statistik dashboard milik user yang sedang login.
// Semua nilai berbasis JWT (req.user.id), tidak pernah dari query/params/body.
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = Number((req as any).user.id);

    // total_articles: jumlah artikel milik user
    const [articleRows] = await db.query(
      "SELECT COUNT(*) AS total_articles FROM posts WHERE user_id = ?",
      [userId],
    );

    // total_views: SUM view_count artikel milik user, coalesce ke 0 jika belum ada artikel
    const [viewRows] = await db.query(
      "SELECT COALESCE(SUM(view_count), 0) AS total_views FROM posts WHERE user_id = ?",
      [userId],
    );

    // total_likes: jumlah like yang diterima artikel milik user (JOIN efisien, tidak loop di JS)
    const [likeRows] = await db.query(
      `SELECT COUNT(*) AS total_likes
       FROM likes
       JOIN posts ON likes.post_id = posts.id
       WHERE posts.user_id = ?`,
      [userId],
    );

    // total_bookmarks: jumlah bookmark yang dibuat oleh user (berdasarkan bookmarks.user_id JWT)
    const [bookmarkRows] = await db.query(
      "SELECT COUNT(*) AS total_bookmarks FROM bookmarks WHERE user_id = ?",
      [userId],
    );

    const total_articles = Number((articleRows as any[])[0]?.total_articles ?? 0);
    const total_views = Number((viewRows as any[])[0]?.total_views ?? 0);
    const total_likes = Number((likeRows as any[])[0]?.total_likes ?? 0);
    const total_bookmarks = Number((bookmarkRows as any[])[0]?.total_bookmarks ?? 0);

    return res.status(200).json({
      success: true,
      data: {
        total_articles,
        total_views,
        total_likes,
        total_bookmarks,
      },
    });
  } catch (error) {
    console.error("GET /statistics ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil statistik",
    });
  }
});

export default router;
