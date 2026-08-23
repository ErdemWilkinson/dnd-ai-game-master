require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { loadAll, cleanupStaleSessions } = require("./services/persistence");
const characterRouter = require("./routes/character");
const chatRouter = require("./routes/chat");
const sceneRouter = require("./routes/scene");

const app = express();
const PORT = process.env.PORT || 3001;

// Faz 9 (yaratıcı cron fikir #1): 30 gündür hiç aktivite görmemiş session/
// karakterleri temizler - ücretsiz Postgres'in 1GB sınırına sınırsız birikim
// çarpmasın diye. Test ortamında (VITEST) hiç çalışmaz.
const STALE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function runStaleSessionCleanup() {
  cleanupStaleSessions(STALE_SESSION_MAX_AGE_MS)
    .then((count) => {
      if (count > 0) console.log(`Eski session temizliği: ${count} session silindi.`);
    })
    .catch((err) => console.error("Eski session temizliği başarısız:", err.message));
}

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
  if (!process.env.VITEST) {
    runStaleSessionCleanup();
    setInterval(runStaleSessionCleanup, CLEANUP_INTERVAL_MS).unref();
  }
  app.listen(PORT, () => {
    console.log(`Backend server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Sunucu başlatılamadı:", err);
  process.exit(1);
});

module.exports = app;
