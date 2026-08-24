require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const db = require("./data/db");
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

// Yaratıcı cron fikir #23: hiç güvenlik header'ı yoktu (ör. X-Powered-By:
// Express framework bilgisini sızdırıyordu) - helmet standart bir hardening
// header seti ekliyor (X-Content-Type-Options, X-Frame-Options, vb.).
app.use(helmet());

// Yaratıcı cron fikir #34: `cors()` argümansız TÜM origin'lere açıktı -
// herhangi bir üçüncü taraf site backend'e doğrudan (kullanıcının
// tarayıcısı üzerinden, credential'sız da olsa) istek atabiliyordu.
// `FRONTEND_ORIGIN` (virgülle ayrılmış, render.yaml'da sabit prod URL'i
// olarak ayarlanacak) izinli origin listesini belirliyor - hiç
// ayarlanmazsa sadece yerel dev origin'lerine (Vite varsayılan portu)
// izin veriliyor. Origin header'ı OLMAYAN istekler (curl, supertest,
// sunucu-sunucu çağrıları, health check) `cors` paketinin standart
// davranışıyla tutarlı şekilde her zaman geçiyor - tarayıcı DIŞI
// istemcileri kırmak bu değişikliğin amacı değil.
const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...DEV_ORIGINS, ...configuredOrigins])];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS: izinli olmayan origin."));
      }
    },
  }),
);
app.use(express.json());

// Yaratıcı cron fikir #7: eskiden sabit {status:"ok"} dönüyordu, DB
// bağlantısı hiç kontrol edilmiyordu - Postgres çökerse Render fark etmezdi.
// Render'ın healthCheckPath'i (render.yaml) bu uca bağlı olduğundan artık
// gerçek bir ping yapılıp başarısız olursa 503 dönüyor.
app.get("/api/health", async (_req, res) => {
  try {
    await db.ping();
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Health check başarısız (DB ping):", err.message);
    res.status(503).json({ status: "error", error: "DB bağlantısı kurulamadı." });
  }
});

app.use("/api/character", characterRouter);
app.use("/api/chat", chatRouter);
app.use("/api/scene", sceneRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, next) => {
  if (err && err.message === "CORS: izinli olmayan origin.") {
    return res.status(403).json({ error: err.message });
  }
  next(err);
});

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
