import { Router } from "express";
import db from "../config/database.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// Semua endpoint likes wajib login. user_id selalu diambil dari JWT,
// tidak pernah dari body/query/path. Termasuk admin: likes selalu
// scoped ke req.user.id tanpa bypass.

function parsePositiveInt(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(typeof raw === "string" ? raw : "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function mapArticleWithAuthor(row: any) {
  return {
    ...row,
    author:
      row.user_id == null
        ? null
        : {
            id: row.user_id,
            name: row.author_name,
            email: row.author_email,
          },
  };
}

// POST /likes/:postId — like artikel milik user yang login.
router.post("/:postId", authMiddleware, async (req, res) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (postId === null) {
      return res.status(400).json({
        success: false,
        message: "ID artikel tidak valid",
      });
    }

    const userId = Number((req as any).user.id);

    const [postRows] = await db.query("SELECT id FROM posts WHERE id = ?", [
      postId,
    ]);

    if ((postRows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: "Artikel tidak ditemukan",
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM likes WHERE user_id = ? AND post_id = ?",
      [userId, postId],
    );

    if ((existing as any[]).length > 0) {
      return res.status(409).json({
        success: false,
        message: "Artikel sudah di-like",
      });
    }

    const [result] = await db.query(
      "INSERT INTO likes (user_id, post_id) VALUES (?, ?)",
      [userId, postId],
    );

    return res.status(201).json({
      success: true,
      message: "Artikel berhasil di-like",
      data: {
        id: (result as any).insertId,
        post_id: postId,
      },
    });
  } catch (error: any) {
    // Pengaman race condition: UNIQUE(user_id, post_id) di database.
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Artikel sudah di-like",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal menambahkan like",
    });
  }
});

// DELETE /likes/:postId — hapus like milik user yang login.
router.delete("/:postId", authMiddleware, async (req, res) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (postId === null) {
      return res.status(400).json({
        success: false,
        message: "ID artikel tidak valid",
      });
    }

    const userId = Number((req as any).user.id);

    const [result] = await db.query(
      "DELETE FROM likes WHERE user_id = ? AND post_id = ?",
      [userId, postId],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Like tidak ditemukan",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Like berhasil dihapus",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus like",
    });
  }
});

// GET /likes — daftar artikel yang di-like user yang login (pagination wajib).
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = Number((req as any).user.id);

    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    const pageInput = Array.isArray(rawPage) ? rawPage[0] : rawPage;
    const limitInput = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;

    const parsedPage = Number.parseInt(
      typeof pageInput === "string" ? pageInput : "",
      10,
    );
    const parsedLimit = Number.parseInt(
      typeof limitInput === "string" ? limitInput : "",
      10,
    );
    const page =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 10;

    const baseSelect = `
            SELECT
                posts.id,
                posts.title,
                posts.content,
                posts.category_id,
                posts.image,
                posts.user_id,
                categories.name AS category,
                users.name AS author_name,
                users.email AS author_email,
                likes.id AS like_id,
                likes.created_at AS liked_at
            FROM likes
            JOIN posts
                ON likes.post_id = posts.id
            JOIN categories
                ON posts.category_id = categories.id
            LEFT JOIN users
                ON posts.user_id = users.id
            WHERE likes.user_id = ?
        `;

    const baseCount = `
            SELECT COUNT(*) AS total
            FROM likes
            JOIN posts
                ON likes.post_id = posts.id
            WHERE likes.user_id = ?
        `;

    const orderClause = "likes.created_at DESC, likes.id DESC";

    const offset = (page - 1) * limit;

    const [countRows] = await db.query(baseCount, [userId]);
    const total = Number((countRows as any[])[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const [rows] = await db.query(
      `${baseSelect} ORDER BY ${orderClause} LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    return res.status(200).json({
      success: true,
      message: "Berhasil mengambil daftar like",
      data: (rows as any[]).map(mapArticleWithAuthor),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar like",
    });
  }
});

// GET /likes/:postId — cek status like milik user yang login.
router.get("/:postId", authMiddleware, async (req, res) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (postId === null) {
      return res.status(400).json({
        success: false,
        message: "ID artikel tidak valid",
      });
    }

    const userId = Number((req as any).user.id);

    const [postRows] = await db.query("SELECT id FROM posts WHERE id = ?", [
      postId,
    ]);

    if ((postRows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: "Artikel tidak ditemukan",
      });
    }

    const [rows] = await db.query(
      "SELECT id FROM likes WHERE user_id = ? AND post_id = ?",
      [userId, postId],
    );

    return res.status(200).json({
      success: true,
      message: "Berhasil mengambil status like",
      data: {
        post_id: postId,
        is_liked: (rows as any[]).length > 0,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil status like",
    });
  }
});

export default router;
