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
const { characters, chatHistories, activeCharacterIdBySession } = require("../data/store");
const { resetFreeformEncounter } = require("./freeformEncounter");

function fireAndForget(maybePromise) {
  Promise.resolve(maybePromise).catch((err) => {
    console.error("Kalıcılık yazması başarısız (in-memory state etkilenmedi):", err.message);
  });
}

function saveCharacter(character) {
  fireAndForget(db.upsertCharacter(character.id, JSON.stringify(character)));
}

function saveChatHistory(sessionId, messages) {
  fireAndForget(db.upsertChatHistory(sessionId, JSON.stringify(messages)));
}

function saveActiveCharacterId(sessionId, characterId) {
  fireAndForget(db.upsertSession(sessionId, characterId));
}

// Faz 6-C: oyuncu öldüğünde "yeniden başla" akışı - session'ın karakter/
// sohbet state'ini temizler. Faz 9 (yaratıcı cron fikir #1): artık
// karakter kaydını da (in-memory + DB) gerçekten siliyor - eskiden sadece
// session bağı kesiliyordu ve karakter satırı kalıcı olarak "sahipsiz"
// (orphan) kalıyordu, ücretsiz Postgres'in 1GB sınırına birikerek çarpardı.
function clearSession(sessionId, characterId) {
  fireAndForget(db.deleteSession(sessionId));
  fireAndForget(db.deleteChatHistory(sessionId));
  if (characterId) {
    characters.delete(characterId);
    fireAndForget(db.deleteCharacter(characterId));
  }
}

// Faz 9: belirli bir süredir hiç aktivite görmemiş session'ları (ve onlara
// bağlı karakter/sohbet verisini) temizler. Server açılışında bir kere
// ve periyodik olarak (bkz. server.js) çağrılır.
async function cleanupStaleSessions(maxAgeMs) {
  const threshold = Date.now() - maxAgeMs;
  const staleSessions = await db.getStaleSessions(threshold);
  for (const row of staleSessions) {
    clearSession(row.session_id, row.active_character_id);
    activeCharacterIdBySession.delete(row.session_id);
    chatHistories.delete(row.session_id);
    // Yaratıcı cron fikir #117: freeformEncounters (services/freeformEncounter.js)
    // bilinçli olarak DB'ye persist edilmiyor (sadece RAM), ama stale
    // temizliği yine de onu unutmamalı - aksi halde haftalarca yeniden
    // başlamayan bir sunucuda dönmeyen session'ların karşılaşma state'i
    // RAM'de sonsuza kadar birikir.
    resetFreeformEncounter(row.session_id);
  }
  return staleSessions.length;
}

// Sunucu açılışında bir kere çağrılır (await edilir - bu tek noktada
// bloklamak sorun değil): DB'deki her şeyi ilgili in-memory Map'e yükler ki
// route'lar restart öncesi kaldığı yerden devam etsin.
async function loadAll() {
  await db.init();

  for (const row of await db.getAllCharacters()) {
    characters.set(row.id, JSON.parse(row.data));
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

module.exports = {
  loadAll,
  saveCharacter,
  saveChatHistory,
  saveActiveCharacterId,
  clearSession,
  cleanupStaleSessions,
};
