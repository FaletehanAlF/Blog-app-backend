import express from "express";
import db from "./config/database.js";
import { postSchema } from "./schemas/post.schema.js";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { categorySchema } from "./schemas/category.schema.js";
import authRoutes from "./routes/auth.js";
import bookmarksRouter from "./routes/bookmarks.js";
import likesRouter from "./routes/likes.js";
import notificationsRouter from "./routes/notifications.js";
import profileRouter from "./routes/profile.js";
import statisticsRouter from "./routes/statistics.js";
import authMiddleware from "./middleware/authMiddleware.js";
import { initSocket } from "./config/socket.js";
import http from "http";
import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET tidak tersedia atau terlalu pendek. Pastikan JWT_SECRET di .env minimal 32 karakter.",
  );
}

const app = express();

app.use(cors());

const jsonParser = express.json();

app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/posts") {
    return next();
  }

  return jsonParser(req, res, next);
});

app.use("/auth", authRoutes);
app.use("/bookmarks", bookmarksRouter);
app.use("/likes", likesRouter);
app.use("/notifications", notificationsRouter);
app.use("/profile", profileRouter);
app.use("/statistics", statisticsRouter);

const port = 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    cb(null, uniqueName);
  },
});

const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Hanya file gambar (jpg, jpeg, png, webp) yang diperbolehkan",
        ),
      );
    }
  },
});

app.use("/uploads", express.static(uploadsDir));

app.get("/categories", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = Number(user.id);

    // Admin melihat seluruh kategori, user biasa hanya kategori miliknya sendiri.
    const [rows] =
      user.role === "admin"
        ? await db.query(
            `SELECT categories.id, categories.name, categories.user_id,
                    users.name AS owner_name
             FROM categories
             LEFT JOIN users ON categories.user_id = users.id
             ORDER BY categories.id DESC`,
          )
        : await db.query(
            `SELECT categories.id, categories.name, categories.user_id,
                    users.name AS owner_name
             FROM categories
             LEFT JOIN users ON categories.user_id = users.id
             WHERE categories.user_id = ?
             ORDER BY categories.id DESC`,
            [userId],
          );

    res.status(200).json({
      success: true,
      message: "Berhasil mengambil data kategori",
      data: rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data kategori",
    });
  }
});

app.post("/categories", authMiddleware, async (req, res) => {
  try {
    const validation = categorySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Data tidak valid",
        errors: validation.error.issues,
      });

      return;
    }

    const { name } = validation.data;

    // Ownership kategori selalu diambil dari JWT, bukan dari request body.
    const ownerId = Number((req as any).user.id);

    const [result] = await db.query(
      "INSERT INTO categories (name, user_id) VALUES (?, ?)",
      [name, ownerId],
    );

    res.status(201).json({
      success: true,
      message: "Kategori berhasil ditambahkan",
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal menambahkan kategori",
    });
  }
});

app.put("/categories/:id", authMiddleware, async (req, res) => {
  try {
    const validation = categorySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Data tidak valid",
        errors: validation.error.issues,
      });

      return;
    }

    const { name } = validation.data;
    const { id } = req.params;
    const user = (req as any).user;
    const userId = Number(user.id);

    const [catRows] = await db.query(
      "SELECT id, user_id FROM categories WHERE id = ?",
      [id],
    );

    if ((catRows as any[]).length === 0) {
      res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });

      return;
    }

    const categoryOwner = (catRows as any[])[0].user_id;

    if (
      user.role !== "admin" &&
      (categoryOwner == null || Number(categoryOwner) !== userId)
    ) {
      res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk mengedit kategori ini",
      });

      return;
    }

    const [result] = await db.query(
      "UPDATE categories SET name = ? WHERE id = ?",
      [name, id],
    );

    res.status(200).json({
      success: true,
      message: "Kategori berhasil diubah",
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal mengubah kategori",
    });
  }
});

app.delete("/categories/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = Number(user.id);

    const [catRows] = await db.query(
      "SELECT id, user_id FROM categories WHERE id = ?",
      [id],
    );

    if ((catRows as any[]).length === 0) {
      res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });

      return;
    }

    const categoryOwner = (catRows as any[])[0].user_id;

    if (
      user.role !== "admin" &&
      (categoryOwner == null || Number(categoryOwner) !== userId)
    ) {
      res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menghapus kategori ini",
      });

      return;
    }

    const [posts] = await db.query(
      "SELECT id FROM posts WHERE category_id = ?",
      [id],
    );

    if ((posts as any[]).length > 0) {
      res.status(400).json({
        success: false,
        message:
          "Kategori tidak dapat dihapus karena masih digunakan oleh artikel",
      });

      return;
    }

    const [result] = await db.query("DELETE FROM categories WHERE id = ?", [
      id,
    ]);

    res.status(200).json({
      success: true,
      message: "Kategori berhasil dihapus",
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal menghapus kategori",
    });
  }
});

app.get("/posts", authMiddleware, async (req, res) => {
  try {
    const rawSearch = req.query.search;
    const searchInput = Array.isArray(rawSearch) ? rawSearch[0] : rawSearch;
    const search = typeof searchInput === "string" ? searchInput.trim() : "";

    // Pagination hanya aktif jika client mengirim ?page= dan/atau ?limit=.
    // Tanpa keduanya, perilaku existing (kembalikan semua data) dipertahankan.
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    const pageInput = Array.isArray(rawPage) ? rawPage[0] : rawPage;
    const limitInput = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
    const paginated = pageInput !== undefined || limitInput !== undefined;

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

    // Sort via whitelist server-side: nilai req.query.sort hanya dipakai
    // sebagai kunci lookup, fragmen ORDER BY selalu berasal dari konstanta
    // di bawah. Nilai tidak valid/absen → fallback urutan existing.
    const rawSort = req.query.sort;
    const sortInput = Array.isArray(rawSort) ? rawSort[0] : rawSort;
    const sortKey =
      typeof sortInput === "string" ? sortInput.trim() : "";
    const sortWhitelist: Record<string, string> = {
      latest: "posts.id DESC",
      oldest: "posts.id ASC",
      title_asc: "posts.title ASC, posts.id DESC",
      title_desc: "posts.title DESC, posts.id DESC",
    };
    const orderClause = sortWhitelist[sortKey] ?? "posts.id DESC";

    const baseSelect = `
            SELECT
                posts.id,
                posts.title,
                posts.content,
                posts.category_id,
                posts.image,
                posts.view_count,
                posts.user_id,
                categories.name AS category,
                users.name AS author_name,
                users.email AS author_email,
                users.profile_image AS author_profile_image,
                COALESCE(like_counts.like_count, 0) AS like_count
            FROM posts
            JOIN categories
                ON posts.category_id = categories.id
            LEFT JOIN users
                ON posts.user_id = users.id
            LEFT JOIN (
                SELECT
                    post_id,
                    COUNT(*) AS like_count
                FROM likes
                GROUP BY post_id
            ) AS like_counts
                ON like_counts.post_id = posts.id
        `;

    const baseCount = `
            SELECT COUNT(*) AS total
            FROM posts
            JOIN categories
                ON posts.category_id = categories.id
        `;

    // WHERE clause disharing antara query data dan query COUNT agar
    // total selalu konsisten dengan filter search yang sama.
    let whereClause = "";
    const whereParams: any[] = [];

    if (search) {
      // Escape karakter khusus LIKE (backslash, %, _) agar diperlakukan
      // sebagai literal. Query tetap parameterized via placeholder "?".
      const escapedSearch = search
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
      const pattern = `%${escapedSearch}%`;

      whereClause = ` WHERE posts.title LIKE ? ESCAPE '\\\\' OR categories.name LIKE ? ESCAPE '\\\\'`;
      whereParams.push(pattern, pattern);
    }

    if (!paginated) {
      const [rows] = await db.query(
        `${baseSelect}${whereClause} ORDER BY ${orderClause}`,
        whereParams,
      );

      const data = (rows as any[]).map((row) => ({
        ...row,
        like_count: Number(row.like_count ?? 0),
        view_count: Number(row.view_count ?? 0),
        author:
          row.user_id == null
            ? null
            : {
                id: row.user_id,
                name: row.author_name,
                email: row.author_email,
                profile_image: row.author_profile_image,
              },
      }));

      res.status(200).json({
        success: true,
        message: "Berhasil mengambil data artikel",
        data,
      });

      return;
    }

    const offset = (page - 1) * limit;

    const [countRows] = await db.query(
      `${baseCount}${whereClause}`,
      whereParams,
    );
    const total = Number((countRows as any[])[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const [rows] = await db.query(
      `${baseSelect}${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset],
    );

    const data = (rows as any[]).map((row) => ({
      ...row,
      like_count: Number(row.like_count ?? 0),
      view_count: Number(row.view_count ?? 0),
      author:
        row.user_id == null
          ? null
          : {
              id: row.user_id,
              name: row.author_name,
              email: row.author_email,
              profile_image: row.author_profile_image,
            },
    }));

    res.status(200).json({
      success: true,
      message: "Berhasil mengambil data artikel",
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data artikel",
    });
  }
});

app.get("/posts/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
            SELECT
                posts.id,
                posts.title,
                posts.content,
                posts.category_id,
                posts.image,
                posts.view_count,
                posts.user_id,
                categories.name AS category,
                users.name AS author_name,
                users.email AS author_email,
                users.profile_image AS author_profile_image,
                COALESCE(like_counts.like_count, 0) AS like_count
            FROM posts
            JOIN categories
                ON posts.category_id = categories.id
            LEFT JOIN users
                ON posts.user_id = users.id
            LEFT JOIN (
                SELECT
                    post_id,
                    COUNT(*) AS like_count
                FROM likes
                GROUP BY post_id
            ) AS like_counts
                ON like_counts.post_id = posts.id
            WHERE posts.id = ?
            `,
      [id],
    );

    if ((rows as any[]).length === 0) {
      res.status(404).json({
        success: false,
        message: "Artikel tidak ditemukan",
      });

      return;
    }

    const detail = (rows as any[])[0];

    res.status(200).json({
      success: true,
      message: "Berhasil mengambil detail artikel",
      data: {
        ...detail,
        like_count: Number(detail.like_count ?? 0),
        view_count: Number(detail.view_count ?? 0),
        author:
          detail.user_id == null
            ? null
            : {
                id: detail.user_id,
                name: detail.author_name,
                email: detail.author_email,
                profile_image: detail.author_profile_image,
              },
      },
    });
  } catch (error) {
    console.error("GET /posts ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil detail artikel",
    });
  }
});

app.post("/posts/:id/view", authMiddleware, async (req, res) => {
  try {
    const rawId = (req.params as any).id;
    const idStr = Array.isArray(rawId) ? String(rawId[0]) : String(rawId);
    const parsed = Number.parseInt(idStr, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID artikel tidak valid",
      });
    }

    const postId = parsed;

    // Atomic increment: aman dari race condition, tidak ada SELECT -> +1 -> UPDATE.
    const [updateResult] = await db.query(
      "UPDATE posts SET view_count = view_count + 1 WHERE id = ?",
      [postId],
    );

    if ((updateResult as any).affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Artikel tidak ditemukan",
      });
    }

    const [rows] = await db.query("SELECT view_count FROM posts WHERE id = ?", [
      postId,
    ]);
    const viewCount = Number((rows as any[])[0]?.view_count ?? 0);

    return res.status(200).json({
      success: true,
      message: "View berhasil ditambahkan",
      data: {
        post_id: postId,
        view_count: viewCount,
      },
    });
  } catch (error) {
    console.error("POST /posts/:id/view ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menambahkan view",
    });
  }
});

app.post(
  "/posts",
  authMiddleware,
  (req, res, next) => {
    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("application/json")) {
      res.status(400).json({
        success: false,
        message:
          "Content-Type harus multipart/form-data, bukan application/json",
      });

      return;
    }

    upload.single("image")(req, res, (error: any) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          if (error.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({
              success: false,
              message: "Ukuran file maksimal 5 MB",
            });

            return;
          }

          res.status(400).json({
            success: false,
            message: error.message,
          });

          return;
        }

        res.status(400).json({
          success: false,
          message: error.message,
        });

        return;
      }

      next();
    });
  },

  async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = user.id;
      const parsedBody = {
        title: req.body?.title,
        content: req.body?.content,
        category_id: Number(req.body?.category_id),
      };

      const validation = postSchema.safeParse(parsedBody);

      if (!validation.success) {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        res.status(400).json({
          success: false,
          message: "Data tidak valid",
          errors: validation.error.issues,
        });

        return;
      }

      const { title, content, category_id } = validation.data;

      const [category] = await db.query(
        "SELECT id, user_id FROM categories WHERE id = ?",
        [category_id],
      );

      if ((category as any[]).length === 0) {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        res.status(400).json({
          success: false,
          message: "Kategori tidak ditemukan",
        });

        return;
      }

      // User hanya boleh memakai kategori miliknya sendiri. Admin bebas.
      const categoryOwner = (category as any[])[0].user_id;

      if (
        user.role !== "admin" &&
        (categoryOwner == null || Number(categoryOwner) !== Number(userId))
      ) {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        res.status(403).json({
          success: false,
          message: "Anda tidak dapat menggunakan kategori milik user lain",
        });

        return;
      }

      const image = req.file ? `/uploads/${req.file.filename}` : null;

      const [result] = await db.query(
        `
                INSERT INTO posts
                (title, content, category_id, image, user_id)
                VALUES (?, ?, ?, ?, ?)
                `,
        [title, content, category_id, image, userId],
      );

      res.status(201).json({
        success: true,
        message: "Artikel berhasil ditambahkan",
        data: result,
      });
    } catch (error) {
      console.error(error);

      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({
        success: false,
        message: "Gagal menambahkan artikel",
      });
    }
  },
);

app.put(
  "/posts/:id",
  authMiddleware,
  (req, res, next) => {
    upload.single("image")(req, res, (error: any) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          if (error.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({
              success: false,
              message: "Ukuran file maksimal 5 MB",
            });

            return;
          }

          res.status(400).json({
            success: false,
            message: error.message,
          });

          return;
        }

        res.status(400).json({
          success: false,
          message: error.message,
        });

        return;
      }

      next();
    });
  },

  async (req, res) => {
    try {
      const { id } = req.params;

      const user = (req as any).user;
      const userId = Number((req as any).user.id);

      const [postRows] = await db.query(
        "SELECT id, image, user_id FROM posts WHERE id = ?",
        [id],
      );

      const posts = postRows as any[];

      if (posts.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Artikel tidak ditemukan",
        });
      }

      if (Number(posts[0].user_id) !== userId && user.role !== "admin") {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        res.status(403).json({
          success: false,
          message: "Anda tidak memiliki akses untuk mengedit artikel ini",
        });

        return;
      }

      const parsedBody = {
        title: req.body?.title,
        content: req.body?.content,
        category_id: Number(req.body?.category_id),
      };

      const validation = postSchema.safeParse(parsedBody);

      if (!validation.success) {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        res.status(400).json({
          success: false,
          message: "Data tidak valid",
          errors: validation.error.issues,
        });

        return;
      }

      const { title, content, category_id } = validation.data;

      const [categoryRows] = await db.query(
        "SELECT id, user_id FROM categories WHERE id = ?",
        [category_id],
      );

      const categories = categoryRows as any[];

      if (categories.length === 0) {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        res.status(400).json({
          success: false,
          message: "Kategori tidak ditemukan",
        });

        return;
      }

      // Jika user mengganti kategori, kategori baru harus miliknya sendiri. Admin bebas.
      const newCategoryOwner = categories[0].user_id;

      if (
        user.role !== "admin" &&
        (newCategoryOwner == null || Number(newCategoryOwner) !== userId)
      ) {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        res.status(403).json({
          success: false,
          message: "Anda tidak dapat menggunakan kategori milik user lain",
        });

        return;
      }

      const oldImage = posts[0].image;

      if (req.file) {
        const newImage = `/uploads/${req.file.filename}`;

        await db.query(
          `
                    UPDATE posts
                    SET title = ?, content = ?, category_id = ?, image = ?
                    WHERE id = ?
                    `,
          [title, content, category_id, newImage, id],
        );

        if (oldImage) {
          const oldImagePath = path.join(
            __dirname,
            "..",
            oldImage.replace(/^\/uploads\//, "uploads/"),
          );

          if (fs.existsSync(oldImagePath)) {
            fs.unlink(oldImagePath, () => {});
          }
        }
      } else {
        await db.query(
          `
                    UPDATE posts
                    SET title = ?, content = ?, category_id = ?
                    WHERE id = ?
                    `,
          [title, content, category_id, id],
        );
      }

      const [updatedRows] = await db.query(
        `
                SELECT
                    posts.id,
                    posts.title,
                    posts.content,
                    posts.category_id,
                    posts.image,
                    posts.user_id,
                    categories.name AS category,
                    users.name AS author_name,
                    users.email AS author_email
                FROM posts
                JOIN categories
                    ON posts.category_id = categories.id
                LEFT JOIN users
                    ON posts.user_id = users.id
                WHERE posts.id = ?
                `,
        [id],
      );

      const updated = (updatedRows as any[])[0];

      res.status(200).json({
        success: true,
        message: "Artikel berhasil diperbarui",
        data: {
          ...updated,
          author:
            updated.user_id == null
              ? null
              : {
                  id: updated.user_id,
                  name: updated.author_name,
                  email: updated.author_email,
                },
        },
      });
    } catch (error) {
      console.error("PUT /posts ERROR:", error);

      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({
        success: false,
        message: "Gagal memperbarui artikel",
      });
    }
  },
);

app.delete("/posts/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = Number((req as any).user.id);

    const [postRows] = await db.query(
      "SELECT id, image, user_id FROM posts WHERE id = ?",
      [id],
    );

    const posts = postRows as any[];

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Artikel tidak ditemukan",
      });
    }

    if (Number(posts[0].user_id) !== userId && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menghapus artikel ini",
      });
    }

    const oldImage = posts[0].image;

    const [result] = await db.query("DELETE FROM posts WHERE id = ?", [id]);

    if (oldImage) {
      const oldImagePath = path.join(
        __dirname,
        "..",
        (oldImage as string).replace(/^\/uploads\//, "uploads/"),
      );

      if (fs.existsSync(oldImagePath)) {
        fs.unlink(oldImagePath, () => {});
      }
    }

    res.status(200).json({
      success: true,
      message: "Artikel berhasil dihapus",
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal menghapus artikel",
    });
  }
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (
      err instanceof SyntaxError &&
      (err as any).status === 400 &&
      "body" in err
    ) {
      console.error("SyntaxError JSON:", err);

      res.status(400).json({
        success: false,
        message: "Format JSON tidak valid",
      });

      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          message: "Ukuran file maksimal 5 MB",
        });

        return;
      }

      res.status(400).json({
        success: false,
        message: err.message,
      });

      return;
    }

    if (err) {
      console.error("Unhandled error:", err);

      res.status(err.status || 500).json({
        success: false,
        message: err.message || "Terjadi kesalahan server",
      });

      return;
    }
  },
);

const server = http.createServer(app);

initSocket(server);

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
