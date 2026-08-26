// Faz 12-A (serbest-form mimari sıfırlaması, kullanıcı kararı): grid'in
// x/y'li sahne state'inin (data/store.js: scenes) yanında, SADECE `/chat`'in
// serbest metin savaşı için kullandığı, x/y/engel/hareket İÇERMEYEN çok daha
// basit bir "aktif düşman" state'i. Kaynak olarak grid'in de kullandığı aynı
// `data/encounters.js` havuzunu paylaşır (içerik ikilenmiyor), sadece
// enemy'lerden x/y/speed atılıp {id,name,hp,maxHp} alınır.
//
// Bilinçli olarak DB'ye PERSIST EDİLMİYOR (PM ile karar): grid sistemi henüz
// paralel çalışıyor ve zaten persist ediliyor, bu state'in şekli Faz 12-B'de
// (frontend entegrasyonu) hâlâ değişebilir, Faz 12-C'de grid kalkıp bu tek
// sistem olunca SQLite+Postgres'e doğru bir kalıcılık eklenecek. Bu ara
// dönemde sunucu restart'ında serbest-form savaş ilerlemesinin sıfırlanması
// kabul edilebilir bir kısıtlama (grid hâlâ tam işlevsel/persist ediliyor).
const { nanoid } = require("nanoid");
const { ENCOUNTERS } = require("../data/encounters");

const freeformEncounters = new Map();

function buildState(encounterIndex) {
  const encounter = ENCOUNTERS[encounterIndex % ENCOUNTERS.length];
  return {
    encounterIndex,
    name: encounter.name,
    totalEncounters: ENCOUNTERS.length,
    enemies: encounter.enemies.map((e) => ({ id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp })),
    loot: encounter.loot.map((l) => ({ id: nanoid(), name: l.name })),
  };
}

function getFreeformEncounter(sessionId) {
  if (!freeformEncounters.has(sessionId)) {
    freeformEncounters.set(sessionId, buildState(0));
  }
  return freeformEncounters.get(sessionId);
}

// Yaratıcı cron fikir #87: grid'in `routes/scene.js`'teki `checkEncounterCleared()`'ı
// TÜM havuzu bir kere turlayınca ("clearedIndex+1 % totalEncounters === 0")
// özel bir "Tüm bölgeyi temizledin!" anı yaşatıyordu - serbest-form yolunda
// bu hiç yoktu. Aynı modulo kontrolü burada da uygulanıp `completedFullLap`
// olarak döndürülüyor, `chat.js` bunu narrasyona ekliyor.
function advanceFreeformEncounter(sessionId) {
  const current = getFreeformEncounter(sessionId);
  const completedFullLap = (current.encounterIndex + 1) % ENCOUNTERS.length === 0;
  const next = buildState(current.encounterIndex + 1);
  freeformEncounters.set(sessionId, next);
  return { ...next, completedFullLap };
}

function resetFreeformEncounter(sessionId) {
  freeformEncounters.delete(sessionId);
}

module.exports = { getFreeformEncounter, advanceFreeformEncounter, resetFreeformEncounter };
