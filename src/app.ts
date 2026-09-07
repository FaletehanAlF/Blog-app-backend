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

app.get("/posts/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT 
                posts.id,
                posts.title,
                posts.content,
                categories.name AS category
            FROM posts
            JOIN categories
                ON posts.category_id = categories.id
            WHERE posts.id = ?
        `, [id]);

        if ((rows as any[]).length === 0) {
            res.status(404).json({
                success: false,
                message: "Artikel tidak ditemukan"
            });

            return;
        }

        res.status(200).json({
            success: true,
            data: (rows as any[])[0]
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail artikel"
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
        
        if ((result as any).affectedRows === 0) {
        res.status(404).json({
            success: false,
            message: "Artikel tidak ditemukan"
        });

        return;
      }

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

        if ((result as any).affectedRows === 0) {
            res.status(404).json({
                success: false,
                message: "Artikel tidak ditemukan"
            });

            return;
        }

        res.status(200).json({
            success: true,
            message: "Artikel berhasil dihapus",
            data: result
        });

        if ((result as any).affectedRows === 0) {
    res.status(404).json({
        success: false,
        message: "Artikel tidak ditemukan"
    });

    return;
}
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