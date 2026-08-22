// Faz 6-B / 7-B: repository katmanı. Route'lar hâlâ `data/store.js`'teki
// sıradan in-memory Map'leri okuyup referans üzerinden mutasyona uğratıyor
// (Faz 1'den beri kullanılan desen) - bu katman sadece bu Map'leri sunucu
// açılışında DB'den doldurur (loadAll) ve route'lar bir mutasyon sonrası
// state'i kalıcı hale getirmek istediğinde çağırdığı save* fonksiyonlarını
// sağlar.
//
// `data/db.js`, DATABASE_URL varsa Postgres'e (asenkron/Promise), yoksa
// SQLite'a (senkron) çözülür. save* fonksiyonları her iki durumda da aynı
// senkron-görünümlü çağrı şeklini koruyor: SQLite'ta gerçekten senkron/
// bloklayıcı, Postgres'te ise "fire and forget" (yanıtı beklemeden yazılır,
// hata olursa loglanır) - in-memory Map zaten çalışma-zamanı otoritesi
// olduğundan bu kabul edilebilir bir tasarım (Faz 6-B'deki karardan devam).

const db = require("../data/db");
const { characters, scenes, chatHistories, activeCharacterIdBySession } = require("../data/store");

function fireAndForget(maybePromise) {
  Promise.resolve(maybePromise).catch((err) => {
    console.error("Kalıcılık yazması başarısız (in-memory state etkilenmedi):", err.message);
  });
}

function saveCharacter(character) {
  fireAndForget(db.upsertCharacter(character.id, JSON.stringify(character)));
}

function saveScene(sessionId, scene) {
  fireAndForget(db.upsertScene(sessionId, JSON.stringify(scene)));
}

function saveChatHistory(sessionId, messages) {
  fireAndForget(db.upsertChatHistory(sessionId, JSON.stringify(messages)));
}

function saveActiveCharacterId(sessionId, characterId) {
  fireAndForget(db.upsertSession(sessionId, characterId));
}

// Faz 6-C: oyuncu öldüğünde "yeniden başla" akışı - session'ın karakter/
// sahne/sohbet state'ini temizler (karakter kaydı DB'de kalır, sadece
// session'ın ona işaret etmesi kesilir - geçmiş karakterleri silmeye gerek yok).
function clearSession(sessionId) {
  fireAndForget(db.deleteSession(sessionId));
  fireAndForget(db.deleteScene(sessionId));
  fireAndForget(db.deleteChatHistory(sessionId));
}

// Sunucu açılışında bir kere çağrılır (await edilir - bu tek noktada
// bloklamak sorun değil): DB'deki her şeyi ilgili in-memory Map'e yükler ki
// route'lar restart öncesi kaldığı yerden devam etsin.
async function loadAll() {
  await db.init();

  for (const row of await db.getAllCharacters()) {
    characters.set(row.id, JSON.parse(row.data));
  }
  for (const row of await db.getAllScenes()) {
    scenes.set(row.session_id, JSON.parse(row.data));
  }
  for (const row of await db.getAllChatHistories()) {
    chatHistories.set(row.session_id, JSON.parse(row.data));
  }
  for (const row of await db.getAllSessions()) {
    if (row.active_character_id) {
      activeCharacterIdBySession.set(row.session_id, row.active_character_id);
    }
  }
}

module.exports = { loadAll, saveCharacter, saveScene, saveChatHistory, saveActiveCharacterId, clearSession };
