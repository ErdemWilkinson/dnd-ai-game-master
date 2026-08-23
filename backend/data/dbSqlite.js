// Faz 6-B / 7-B: SQLite adaptörü (yerel geliştirme + test ortamı varsayılanı).
// Tüm metodlar senkron - dbPostgres.js ile aynı isim/şekli paylaşır ama o
// asenkron (Promise) döner. persistence.js ikisini de Promise.resolve() ile
// sarıp aynı şekilde kullanır.

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

// Faz 9: orphan/eski session temizliği için "en son ne zaman aktifti" bilgisi
// gerekiyor - tablo zaten var olan dağıtımlarda "IF NOT EXISTS" bunu eklemez,
// bu yüzden kolon varlığı elle kontrol edilip yoksa eklenir.
const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
if (!sessionColumns.some((col) => col.name === "updated_at")) {
  db.exec("ALTER TABLE sessions ADD COLUMN updated_at INTEGER");
}

const selectAllCharacters = db.prepare("SELECT id, data FROM characters");
const upsertCharacterStmt = db.prepare(
  "INSERT INTO characters (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
);

const selectAllScenes = db.prepare("SELECT session_id, data FROM scenes");
const upsertSceneStmt = db.prepare(
  "INSERT INTO scenes (session_id, data) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET data = excluded.data",
);

const selectAllChatHistories = db.prepare("SELECT session_id, data FROM chat_histories");
const upsertChatHistoryStmt = db.prepare(
  "INSERT INTO chat_histories (session_id, data) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET data = excluded.data",
);

const selectAllSessions = db.prepare("SELECT session_id, active_character_id FROM sessions");
const upsertSessionStmt = db.prepare(
  "INSERT INTO sessions (session_id, active_character_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET active_character_id = excluded.active_character_id, updated_at = excluded.updated_at",
);
const deleteSessionStmt = db.prepare("DELETE FROM sessions WHERE session_id = ?");
const deleteSceneStmt = db.prepare("DELETE FROM scenes WHERE session_id = ?");
const deleteChatHistoryStmt = db.prepare("DELETE FROM chat_histories WHERE session_id = ?");
const deleteCharacterStmt = db.prepare("DELETE FROM characters WHERE id = ?");
const selectStaleSessionsStmt = db.prepare(
  "SELECT session_id, active_character_id FROM sessions WHERE updated_at IS NOT NULL AND updated_at < ?",
);

// Yaratıcı cron fikir #7: /api/health'in gerçek bir DB bağlantı kontrolü
// yapabilmesi için basit bir ping.
const pingStmt = db.prepare("SELECT 1");

module.exports = {
  engine: "sqlite",
  ping: () => {
    pingStmt.get();
  },
  // Ham better-sqlite3 Database örneği - geriye dönük uyumluluk için: mevcut
  // testler (persistence.test.js, Faz 6-B) doğrudan db.exec()/db.prepare()
  // ile beyaz-kutu doğrulama yapıyor. Testler VITEST=true altında her zaman
  // SQLite kullandığından bu her zaman gerçek bir örnek olur.
  db,
  init: () => {},
  getAllCharacters: () => selectAllCharacters.all(),
  upsertCharacter: (id, data) => upsertCharacterStmt.run(id, data),
  getAllScenes: () => selectAllScenes.all(),
  upsertScene: (sessionId, data) => upsertSceneStmt.run(sessionId, data),
  getAllChatHistories: () => selectAllChatHistories.all(),
  upsertChatHistory: (sessionId, data) => upsertChatHistoryStmt.run(sessionId, data),
  getAllSessions: () => selectAllSessions.all(),
  upsertSession: (sessionId, characterId) => upsertSessionStmt.run(sessionId, characterId, Date.now()),
  deleteSession: (sessionId) => deleteSessionStmt.run(sessionId),
  deleteScene: (sessionId) => deleteSceneStmt.run(sessionId),
  deleteChatHistory: (sessionId) => deleteChatHistoryStmt.run(sessionId),
  deleteCharacter: (id) => deleteCharacterStmt.run(id),
  getStaleSessions: (beforeMs) => selectStaleSessionsStmt.all(beforeMs),
};
