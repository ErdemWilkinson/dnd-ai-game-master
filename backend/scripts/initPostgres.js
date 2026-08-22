// Faz 7-B: Postgres şemasını elle kurmak için yardımcı script.
// Not: backend zaten her açılışta (server.js -> loadAll() -> db.init())
// bu şemayı otomatik oluşturuyor (CREATE TABLE IF NOT EXISTS) - bu script
// sadece deploy öncesi elle doğrulamak/hazırlamak isteyenler için.
//
// Kullanım: DATABASE_URL="postgres://..." node backend/scripts/initPostgres.js

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ortam değişkeni gerekli.");
  process.exit(1);
}

const db = require("../data/db");

if (db.engine !== "postgres") {
  console.error("DATABASE_URL ayarlı ama seçilen motor 'postgres' değil (VITEST=true mu?).");
  process.exit(1);
}

db.init()
  .then(() => {
    console.log("Postgres şeması hazır (characters, scenes, chat_histories, sessions).");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Şema kurulumu başarısız:", err.message);
    process.exit(1);
  });
