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

// Yaratıcı cron fikir #118 (ÖNEMLİ, veri kaybı riski): `sessions.updated_at`
// (fikir #1'in stale-session temizliğinin dayandığı TEK alan) sadece
// `/character/create`'de (`saveActiveCharacterId` ile) güncelleniyordu -
// `chat.js` hiç çağırmıyordu. Sonuç: 30 gündür AKTİF oynayan ama yeni
// karakter oluşturmamış bir kullanıcının session'ı bile `cleanupStaleSessions()`
// tarafından yanlışlıkla stale sayılıp silinebiliyordu. `chat.js` her
// başarılı istekte bunu çağırır - `activeCharacterIdBySession`'daki MEVCUT
// eşlemeyi aynen geri yazar (upsertSession'ın `updated_at`'i güncelleyen
// AYNI ON CONFLICT deseni), aktif karakteri olmayan (henüz karakter
// oluşturmamış) bir session'ı da "aktif" olarak işaretlemiş olur - bu da
// doğru, session gerçekten kullanımda.
function touchSession(sessionId) {
  const characterId = activeCharacterIdBySession.get(sessionId) ?? null;
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

  // Yaratıcı cron fikir #119 (savunma sağlamlaştırma): eskiden JSON.parse()
  // hiç try/catch'siz çağrılıyordu - tek bir bozuk satır (normal akışta
  // oluşmaz, ama manuel bir DB müdahalesi/yarım kalmış bir yazma sonrası
  // olabilir) loadAll()'ı throw ettirip server.js'in start()'ını
  // process.exit(1)'e sürüklüyordu - TEK kötü satır TÜM sunucunun açılışını
  // engelleyebiliyordu. Artık bozuk satır loglanıp ATLANIYOR, geri kalan
  // sağlam veri yine de yüklenmeye devam ediyor.
  for (const row of await db.getAllCharacters()) {
    try {
      characters.set(row.id, JSON.parse(row.data));
    } catch (err) {
      console.error(`Bozuk karakter verisi atlandı (id=${row.id}):`, err.message);
    }
  }
  for (const row of await db.getAllChatHistories()) {
    try {
      chatHistories.set(row.session_id, JSON.parse(row.data));
    } catch (err) {
      console.error(`Bozuk sohbet geçmişi atlandı (session_id=${row.session_id}):`, err.message);
    }
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
  touchSession,
  clearSession,
  cleanupStaleSessions,
};
