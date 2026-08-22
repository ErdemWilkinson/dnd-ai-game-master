// Faz 6-B: repository katmanı. Route'lar hâlâ `data/store.js`'teki sıradan
// in-memory Map'leri okuyup referans üzerinden mutasyona uğratıyor (Faz 1'den
// beri kullanılan desen, ölçek için yeterince basit) - bu katman sadece bu
// Map'leri sunucu açılışında SQLite'tan doldurur (loadAll) ve route'lar bir
// mutasyon sonrası state'i kalıcı hale getirmek istediğinde çağırdığı
// save* fonksiyonlarını sağlar. DB motoru ileride değişirse (örn. Postgres'e
// geçilirse) sadece bu dosya değişir, route'lar etkilenmez.

const { db } = require("../data/db");
const { characters, scenes, chatHistories, activeCharacterIdBySession } = require("../data/store");

const selectAllCharacters = db.prepare("SELECT id, data FROM characters");
const upsertCharacter = db.prepare(
  "INSERT INTO characters (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
);

const selectAllScenes = db.prepare("SELECT session_id, data FROM scenes");
const upsertScene = db.prepare(
  "INSERT INTO scenes (session_id, data) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET data = excluded.data",
);

const selectAllChatHistories = db.prepare("SELECT session_id, data FROM chat_histories");
const upsertChatHistory = db.prepare(
  "INSERT INTO chat_histories (session_id, data) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET data = excluded.data",
);

const selectAllSessions = db.prepare("SELECT session_id, active_character_id FROM sessions");
const upsertSession = db.prepare(
  "INSERT INTO sessions (session_id, active_character_id) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET active_character_id = excluded.active_character_id",
);

function saveCharacter(character) {
  upsertCharacter.run(character.id, JSON.stringify(character));
}

function saveScene(sessionId, scene) {
  upsertScene.run(sessionId, JSON.stringify(scene));
}

function saveChatHistory(sessionId, messages) {
  upsertChatHistory.run(sessionId, JSON.stringify(messages));
}

function saveActiveCharacterId(sessionId, characterId) {
  upsertSession.run(sessionId, characterId);
}

// Sunucu açılışında bir kere çağrılır: DB'deki her şeyi ilgili in-memory
// Map'e yükler ki route'lar restart öncesi kaldığı yerden devam etsin.
function loadAll() {
  for (const row of selectAllCharacters.all()) {
    characters.set(row.id, JSON.parse(row.data));
  }
  for (const row of selectAllScenes.all()) {
    scenes.set(row.session_id, JSON.parse(row.data));
  }
  for (const row of selectAllChatHistories.all()) {
    chatHistories.set(row.session_id, JSON.parse(row.data));
  }
  for (const row of selectAllSessions.all()) {
    if (row.active_character_id) {
      activeCharacterIdBySession.set(row.session_id, row.active_character_id);
    }
  }
}

module.exports = { loadAll, saveCharacter, saveScene, saveChatHistory, saveActiveCharacterId };
