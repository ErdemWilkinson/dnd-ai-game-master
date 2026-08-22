// Faz 6-B: SQLite tabanlı kalıcılık. Ayrı bir DB sunucusu gerekmez, tek dosya.

const path = require("path");
const Database = require("better-sqlite3");

// Testler (vitest) paylaşılan game.db dosyasını kilitleyip ayrı oturumlar/CI
// koşumlarıyla çakışmasın diye bellek-içi bir DB kullanır - test asertleri zaten
// data/store.js'teki in-memory Map'lere bakıyor, DB sadece yazma tarafı test
// ediliyor olsa da dosya sistemine dokunmadan çalışabilir.
const DB_PATH = process.env.DB_PATH || (process.env.VITEST ? ":memory:" : path.join(__dirname, "..", "game.db"));
const db = new Database(DB_PATH);

if (DB_PATH !== ":memory:") {
  db.pragma("journal_mode = WAL");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scenes (
    session_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_histories (
    session_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    active_character_id TEXT
  );
`);

module.exports = { db };
