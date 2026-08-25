// Yaratıcı cron fikir #72: `dbPostgres.js`'in gerçek davranışı hiçbir testte
// çalışmıyordu - `data/db.js`, `VITEST=true` altında (vitest'in kendi
// otomatik ayarladığı) DATABASE_URL olsa bile HER ZAMAN SQLite'a zorluyor
// (bkz. db.js), yani `npm test` bu dosyayı hiç import etmiyor. Ama prod tam
// olarak bu dosyayı kullanıyor - CI en kritik kod yolunu hiç kapsamıyordu.
//
// Bu script bilinçli olarak `vitest run` İLE DEĞİL, düz `node` ile
// çalıştırılıyor (CI'da: `node scripts/pgSmokeTest.js`) - VITEST env
// değişkeni set OLMADIĞINDAN `data/db.js` gerçekten `dbPostgres.js`'i seçiyor
// (DATABASE_URL varsa). Gerçek bir Postgres'e karşı temel CRUD'ı (init/
// upsert/get/delete/ping) doğrulayan minimal bir smoke test - kapsamlı bir
// test suite değil, "bu dosya gerçekten bir Postgres'e karşı çalışıyor mu"
// sorusuna hızlı bir evet/hayır.

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ayarlı değil - pgSmokeTest gerçek bir Postgres gerektirir.");
  process.exit(1);
}
if (process.env.VITEST) {
  console.error("VITEST set - bu script db.js'in SQLite'a düşmesine neden olur, kaldırıp tekrar dene.");
  process.exit(1);
}

const assert = require("assert");
const db = require("../data/db");

async function main() {
  assert.strictEqual(db.engine, "postgres", `db.js Postgres yerine '${db.engine}' seçti - DATABASE_URL/VITEST kontrol et.`);

  await db.init();
  await db.ping();

  const testId = "pg-smoke-" + Date.now();

  // characters: upsert + getAll + gerçekten update ediyor mu (aynı id ikinci
  // kez yazılınca satır çoğalmıyor mu)
  await db.upsertCharacter(testId, JSON.stringify({ name: "Smoke1" }));
  await db.upsertCharacter(testId, JSON.stringify({ name: "Smoke2" }));
  let characters = await db.getAllCharacters();
  let match = characters.filter((r) => r.id === testId);
  assert.strictEqual(match.length, 1, "upsertCharacter aynı id için ikinci satır oluşturmamalı");
  assert.strictEqual(JSON.parse(match[0].data).name, "Smoke2", "upsertCharacter veriyi güncellemiyor");

  // scenes
  await db.upsertScene(testId, JSON.stringify({ round: 1 }));
  let scenes = await db.getAllScenes();
  assert.ok(scenes.some((r) => r.session_id === testId), "upsertScene sonrası getAllScenes'te bulunamadı");

  // chat histories
  await db.upsertChatHistory(testId, JSON.stringify([{ text: "merhaba" }]));
  let histories = await db.getAllChatHistories();
  assert.ok(histories.some((r) => r.session_id === testId), "upsertChatHistory sonrası getAllChatHistories'te bulunamadı");

  // sessions + stale session sorgusu
  await db.upsertSession(testId, testId);
  let sessions = await db.getAllSessions();
  assert.ok(sessions.some((r) => r.session_id === testId), "upsertSession sonrası getAllSessions'ta bulunamadı");
  const staleAfterFuture = await db.getStaleSessions(Date.now() + 1000 * 60 * 60 * 24 * 365);
  assert.ok(staleAfterFuture.some((r) => r.session_id === testId), "getStaleSessions bir yıl sonrası eşiğiyle bu session'ı stale görmedi");

  // delete'ler gerçekten siliyor mu
  await db.deleteCharacter(testId);
  await db.deleteScene(testId);
  await db.deleteChatHistory(testId);
  await db.deleteSession(testId);

  characters = await db.getAllCharacters();
  scenes = await db.getAllScenes();
  histories = await db.getAllChatHistories();
  sessions = await db.getAllSessions();
  assert.ok(!characters.some((r) => r.id === testId), "deleteCharacter sonrası hâlâ mevcut");
  assert.ok(!scenes.some((r) => r.session_id === testId), "deleteScene sonrası hâlâ mevcut");
  assert.ok(!histories.some((r) => r.session_id === testId), "deleteChatHistory sonrası hâlâ mevcut");
  assert.ok(!sessions.some((r) => r.session_id === testId), "deleteSession sonrası hâlâ mevcut");

  console.log("pgSmokeTest: gerçek Postgres'e karşı tüm CRUD kontrolleri geçti (engine=" + db.engine + ").");
  process.exit(0);
}

main().catch((err) => {
  console.error("pgSmokeTest BAŞARISIZ:", err);
  process.exit(1);
});
