// Faz 7-B: Postgres adaptörü (üretim - Render + ücretsiz Postgres).
// dbSqlite.js ile aynı metod seti, ama asenkron (Promise) döner - persistence.js
// bunu Promise.resolve() ile sararak ikisini de aynı şekilde kullanır.
// Gerçek bir Postgres instance'ı olmadan (DATABASE_URL yokken) bu dosya hiç
// import edilmez (bkz. db.js'teki seçim mantığı).

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

const SCHEMA = `
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
`;

// Faz 9: orphan/eski session temizliği için "en son ne zaman aktifti" bilgisi
// gerekiyor - "IF NOT EXISTS" var olan sessions tablosuna kolon eklemiyor,
// bu yüzden ayrı bir ALTER TABLE ... ADD COLUMN IF NOT EXISTS gerekiyor.
const ADD_UPDATED_AT_COLUMN = `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at BIGINT;`;

async function init() {
  await pool.query(SCHEMA);
  await pool.query(ADD_UPDATED_AT_COLUMN);
}

async function getAllCharacters() {
  const { rows } = await pool.query("SELECT id, data FROM characters");
  return rows;
}

async function upsertCharacter(id, data) {
  await pool.query(
    "INSERT INTO characters (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = excluded.data",
    [id, data],
  );
}

async function getAllScenes() {
  const { rows } = await pool.query("SELECT session_id, data FROM scenes");
  return rows;
}

async function upsertScene(sessionId, data) {
  await pool.query(
    "INSERT INTO scenes (session_id, data) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET data = excluded.data",
    [sessionId, data],
  );
}

async function getAllChatHistories() {
  const { rows } = await pool.query("SELECT session_id, data FROM chat_histories");
  return rows;
}

async function upsertChatHistory(sessionId, data) {
  await pool.query(
    "INSERT INTO chat_histories (session_id, data) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET data = excluded.data",
    [sessionId, data],
  );
}

async function getAllSessions() {
  const { rows } = await pool.query("SELECT session_id, active_character_id FROM sessions");
  return rows;
}

async function upsertSession(sessionId, characterId) {
  await pool.query(
    "INSERT INTO sessions (session_id, active_character_id, updated_at) VALUES ($1, $2, $3) ON CONFLICT (session_id) DO UPDATE SET active_character_id = excluded.active_character_id, updated_at = excluded.updated_at",
    [sessionId, characterId, Date.now()],
  );
}

async function deleteSession(sessionId) {
  await pool.query("DELETE FROM sessions WHERE session_id = $1", [sessionId]);
}

async function deleteScene(sessionId) {
  await pool.query("DELETE FROM scenes WHERE session_id = $1", [sessionId]);
}

async function deleteChatHistory(sessionId) {
  await pool.query("DELETE FROM chat_histories WHERE session_id = $1", [sessionId]);
}

async function deleteCharacter(id) {
  await pool.query("DELETE FROM characters WHERE id = $1", [id]);
}

async function getStaleSessions(beforeMs) {
  const { rows } = await pool.query(
    "SELECT session_id, active_character_id FROM sessions WHERE updated_at IS NOT NULL AND updated_at < $1",
    [beforeMs],
  );
  return rows;
}

// Yaratıcı cron fikir #7: /api/health'in gerçek bir DB bağlantı kontrolü
// yapabilmesi için basit bir ping.
async function ping() {
  await pool.query("SELECT 1");
}

module.exports = {
  engine: "postgres",
  init,
  ping,
  getAllCharacters,
  upsertCharacter,
  getAllScenes,
  upsertScene,
  getAllChatHistories,
  upsertChatHistory,
  getAllSessions,
  upsertSession,
  deleteSession,
  deleteScene,
  deleteChatHistory,
  deleteCharacter,
  getStaleSessions,
};
