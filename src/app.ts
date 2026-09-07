import express from "express";

const app = express();

app.use(express.json());

const port = 8000;

app.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories");
  res.json({
    message: "Blog API Berjalan",
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});