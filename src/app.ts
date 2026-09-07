import express from "express";
import db from "./config/database.js";
import { postSchema } from "./schemas/post.schema.js";

const app = express();

app.use(express.json());

const port = 8000;

app.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories");
    res.status(200).json({
      success: true,
      message: "Berhasil mengambil data kategori",
      data: rows
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data kategori"
    });
  }
});

app.post("/posts", async (req, res) => {
    try {
        const validation = postSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({
                success: false,
                message: "Data tidak valid",
                errors: validation.error.issues
            });

            return;
        }

        const { title, content, category_id } = validation.data;

        const [result] = await db.query(
            "INSERT INTO posts (title, content, category_id) VALUES (?, ?, ?)",
            [title, content, category_id]
        );

        res.status(201).json({
            success: true,
            message: "Artikel berhasil ditambahkan",
            data: result
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan artikel"
        });
    }
});

app.put("/posts/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const validation = postSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({
                success: false,
                message: "Data tidak valid",
                errors: validation.error.issues
            });

            return;
        }

        const { title, content, category_id } = validation.data;

        const [category] = await db.query(
            "SELECT id FROM categories WHERE id = ?",
            [category_id]
        );

        if ((category as any[]).length === 0) {
            res.status(400).json({
                success: false,
                message: "Kategori tidak ditemukan"
            });

            return;
        }

        const [result] = await db.query(
            "UPDATE posts SET title = ?, content = ?, category_id = ? WHERE id = ?",
            [title, content, category_id, id]
        );

        res.status(200).json({
            success: true,
            message: "Artikel berhasil diperbarui",
            data: result
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui artikel"
        });
    }
});

app.delete("/posts/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            "DELETE FROM posts WHERE id = ?",
            [id]
        );

        res.status(200).json({
            success: true,
            message: "Artikel berhasil dihapus",
            data: result
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus artikel"
        });
    }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});