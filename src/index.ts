import express from "express";
import cors from "cors";
import scrapeRoutes from "./routes/scrape";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/ping", (_req, res) => {
  res.json({ success: true, message: "Pong! 🎯", timestamp: Date.now() });
});

app.use(scrapeRoutes);

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
