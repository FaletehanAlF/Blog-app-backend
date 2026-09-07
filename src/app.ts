import express from "express";
import db from "./config/database.js";

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

app.get("/posts", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                posts.id,
                posts.title,
                posts.content,
                categories.name AS category
            FROM posts
            JOIN categories
                ON posts.category_id = categories.id
        `);

        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data artikel"
        });
    }
});

app.post("/posts", async (req, res) => {
    try {
        const { title, content, category_id } = req.body;

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
        const { title, content, category_id } = req.body;

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