require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { loadAll } = require("./services/persistence");
const characterRouter = require("./routes/character");
const chatRouter = require("./routes/chat");
const sceneRouter = require("./routes/scene");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/character", characterRouter);
app.use("/api/chat", chatRouter);
app.use("/api/scene", sceneRouter);

async function start() {
  // Postgres kullanılıyorsa (Faz 7-B) şema/veri yükleme asenkron olur -
  // sunucu dinlemeye başlamadan önce DB'deki state'in Map'lere yüklenmiş
  // olması gerekiyor.
  await loadAll();
  app.listen(PORT, () => {
    console.log(`Backend server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Sunucu başlatılamadı:", err);
  process.exit(1);
});

module.exports = app;
