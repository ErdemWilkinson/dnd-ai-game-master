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

async function init() {
  await pool.query(SCHEMA);
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
    "INSERT INTO sessions (session_id, active_character_id) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET active_character_id = excluded.active_character_id",
    [sessionId, characterId],
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

module.exports = {
  engine: "postgres",
  init,
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
};
