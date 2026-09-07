import express from "express";

const app = express();

app.use(express.json());

const port = 8000;

app.listen(port, () => {
  cons