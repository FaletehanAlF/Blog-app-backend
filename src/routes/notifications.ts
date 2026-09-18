import { Router } from "express";
import db from "../config/database.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

function parsePositiveInt(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(typeof raw === "string" ? raw : "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

// GET /notifications — daftar notification milik user yang login, terbaru pertama.
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = Number((req as any).user.id);

    const [rows] = await db.query(
      `SELECT
        notifications.id,
        notifications.type,
        notifications.message,
        notifications.post_id,
        notifications.actor_user_id,
        users.name AS actor_name,
        notifications.is_read,
        notifications.created_at
      FROM notifications
      JOIN users ON notifications.actor_user_id = users.id
      WHERE notifications.user_id = ?
      ORDER BY notifications.created_at DESC`,
      [userId],
    );

    return res.status(200).json({
      success: true,
      message: "Berhasil mengambil data notifikasi",
      data: rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data notifikasi",
    });
  }
});

// GET /notifications/unread-count — jumlah notification yang belum dibaca.
router.get("/unread-count", authMiddleware, async (req, res) => {
  try {
    const userId = Number((req as any).user.id);

    const [rows] = await db.query(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = false",
      [userId],
    );

    return res.status(200).json({
      success: true,
      data: {
        count: Number((rows as any[])[0]?.count ?? 0),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil jumlah notifikasi belum dibaca",
    });
  }
});

export default router;
