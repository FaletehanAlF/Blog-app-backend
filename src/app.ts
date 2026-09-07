import express from "express";

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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});