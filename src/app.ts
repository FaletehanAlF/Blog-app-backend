import express from "express";
import db from "./config/database.js";
import { postSchema } from "./schemas/post.schema.js";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();

app.use(cors());

const jsonParser = express.json();
app.use((req, res, next) => {
    if (req.method === "POST" && req.path === "/posts") {
        return next();
    }
    return jsonParser(req, res, next);
});

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

const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const allowedExts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
];

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
                    "Hanya file gambar (jpg, jpeg, png, webp) yang diperbolehkan"
                )
            );
        }
    },
});

app.use("/uploads", express.static(uploadsDir));

app.get("/categories", async (_req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM categories"
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

app.get("/posts", async (_req, res) => {
    try {
       const [rows] = await db.query(`
    SELECT
        posts.id,
        posts.title,
        posts.content,
        posts.category_id,
        posts.image,
        categories.name AS category
    FROM posts
    JOIN categories
        ON posts.category_id = categories.id
    ORDER BY posts.id DESC
`);

        res.status(200).json({
            success: true,
            message: "Berhasil mengambil data artikel",
            data: rows,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data artikel",
        });
    }
});

app.get("/posts/:id", async (req, res) => {
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
                categories.name AS category
            FROM posts
            JOIN categories
                ON posts.category_id = categories.id
            WHERE posts.id = ?
            `,
            [id]
        );

        if ((rows as any[]).length === 0) {
            res.status(404).json({
                success: false,
                message: "Artikel tidak ditemukan",
            });

            return;
        }

        res.status(200).json({
            success: true,
            message: "Berhasil mengambil detail artikel",
            data: (rows as any[])[0],
        });
    } catch (error) {
        console.error("GET /posts ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail artikel",
        });
    }
});

app.post(
    "/posts",
    (req, res, next) => {
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
            res.status(400).json({
                success: false,
                message: "Content-Type harus multipart/form-data, bukan application/json",
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
                "SELECT id FROM categories WHERE id = ?",
                [category_id]
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

            const image = req.file ? `/uploads/${req.file.filename}` : null;

            const [result] = await db.query(
                `
                INSERT INTO posts
                (title, content, category_id, image)
                VALUES (?, ?, ?, ?)
                `,
                [title, content, category_id, image]
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
    }
);

app.put(
    "/posts/:id",
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

            const [postRows] = await db.query(
                "SELECT id, image FROM posts WHERE id = ?",
                [id]
            );

            const posts = postRows as any[];

            if (posts.length === 0) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }

                res.status(404).json({
                    success: false,
                    message: "Artikel tidak ditemukan",
                });

                return;
            }

            const parsedBody = {
                title: req.body?.title,
                content: req.body?.content,
                category_id: Number(req.body?.category_id),
            };

            // Validasi menggunakan Zod
            const validation = postSchema.safeParse(parsedBody);

            if (!validation.success) {
                // Hapus file baru jika validasi gagal
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

            // Cek kategori
            const [categoryRows] = await db.query(
                "SELECT id FROM categories WHERE id = ?",
                [category_id]
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

            const oldImage = posts[0].image;

            // Jika user upload gambar baru
            if (req.file) {
                const newImage = `/uploads/${req.file.filename}`;

                await db.query(
                    `
                    UPDATE posts
                    SET title = ?, content = ?, category_id = ?, image = ?
                    WHERE id = ?
                    `,
                    [
                        title,
                        content,
                        category_id,
                        newImage,
                        id,
                    ]
                );
                if (oldImage) {
                    const oldImagePath = path.join(
                        __dirname,
                        "..",
                        oldImage.replace(/^\/uploads\//, "uploads/")
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
                    [
                        title,
                        content,
                        category_id,
                        id,
                    ]
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
                    categories.name AS category
                FROM posts
                JOIN categories
                    ON posts.category_id = categories.id
                WHERE posts.id = ?
                `,
                [id]
            );
            res.status(200).json({
                success: true,
                message: "Artikel berhasil diperbarui",
                data: (updatedRows as any[])[0],
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
    }
);

app.delete("/posts/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [post] = await db.query(
            "SELECT id FROM posts WHERE id = ?",
            [id]
        );

        if ((post as any[]).length === 0) {
            res.status(404).json({
                success: false,
                message: "Artikel tidak ditemukan",
            });

            return;
        }

        const [result] = await db.query(
            "DELETE FROM posts WHERE id = ?",
            [id]
        );

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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && (err as any).status === 400 && "body" in err) {
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
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
