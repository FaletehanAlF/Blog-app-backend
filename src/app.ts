import express from "express";

const app = express();

app.use(express.json());

const port = 8000;

app.get("/", (req, res) => {
  res.json({
    
  })

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});