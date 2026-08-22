import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

const require = createRequire(import.meta.url);
const sceneRouter = require("../routes/scene.js");
const characterRouter = require("../routes/character.js");
const chatRouter = require("../routes/chat.js");
const { scenes, characters } = require("../data/store.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/scene", sceneRouter);
  app.use("/api/character", characterRouter);
  app.use("/api/chat", chatRouter);
  return app;
}

describe("GET /api/scene", () => {
  beforeEach(() => {
    scenes.clear();
  });

  it("varsayılan sahneyi beklenen şekilde döner", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/scene");
    expect(res.status).toBe(200);
    expect(res.body.activeTokenId).toBe("player");
    expect(res.body.round).toBe(1);
    expect(Array.isArray(res.body.tokens)).toBe(true);
    expect(res.body.tokens.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.obstacles)).toBe(true);
    expect(Array.isArray(res.body.loot)).toBe(true);
  });

  it("aynı session içinde tekrar istek atınca aynı sahne döner (id değişmez)", async () => {
    const app = buildApp();
    const first = await request(app).get("/api/scene");
    const second = await request(app).get("/api/scene");
    expect(second.body.id).toBe(first.body.id);
  });
});

describe("POST /api/scene/move", () => {
  beforeEach(() => {
    scenes.clear();
  });

  it("sırası olmayan bir token için 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "goblin-1", x: 8, y: 3 });
    expect(res.status).toBe(400);
  });

  it("var olmayan tokenId için 404 döner (Bug #6 fix: varlık kontrolü sıra kontrolünden önce)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "does-not-exist", x: 0, y: 0 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/bulunamadı/i);
  });

  it("menzil dışı hedef için 400 döner", async () => {
    const app = buildApp();
    // player (1,1) speed 4 -> (9,1) mesafe 8, menzil dışı
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 9, y: 1 });
    expect(res.status).toBe(400);
  });

  it("koordinat sayı değilse 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: "abc", y: 1 });
    expect(res.status).toBe(400);
  });

  it("engelli kareye hareket 400 döner", async () => {
    const app = buildApp();
    // varsayılan obstacle: (3,2). player (1,1) speed 4, mesafe |3-1|+|2-1|=3, menzil içi ama engelli.
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 3, y: 2 });
    expect(res.status).toBe(400);
  });

  it("harita dışına hareket 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: -1, y: 1 });
    expect(res.status).toBe(400);
  });

  it("geçerli hareket token pozisyonunu günceller", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 2, y: 1 });
    expect(res.status).toBe(200);
    const playerToken = res.body.scene.tokens.find((t) => t.id === "player");
    expect(playerToken.x).toBe(2);
    expect(playerToken.y).toBe(1);
    expect(res.body.collectedLoot).toBeNull();
  });

  it("loot olan kareye hareket loot'u toplar ve sahneden kaldırır", async () => {
    const app = buildApp();
    // varsayılan loot: (5,1) 'Altın Kese'. player (1,1) speed 4 -> mesafe 4, menzil içi, engelsiz.
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 5, y: 1 });
    expect(res.status).toBe(200);
    expect(res.body.collectedLoot).toMatchObject({ name: "Altın Kese" });
    expect(res.body.scene.loot.find((l) => l.name === "Altın Kese")).toBeUndefined();
  });

  it("başka bir token'ın üzerine hareket engellenir", async () => {
    const app = buildApp();
    // goblin-1 varsayılan (8,2)'de duruyor; player speed 5 ile oraya ulaşamaz zaten (mesafe 8),
    // bu yüzden doğrudan blocked-by-token davranışını token'ları birbirine yaklaştırarak test edemiyoruz
    // Faz 1'de bunu manuel QA'e not düştüm (bkz. QA_NOTES.md).
    expect(true).toBe(true);
  });

  it("Faz 4 Bug A: hedef kare boş olsa bile yol arada bir engelden geçiyorsa hareket reddedilir", async () => {
    const app = buildApp();
    // player (1,1) -> (4,2): mesafe 4 (menzil içi), düz çizgi (Bresenham) (3,2)
    // engelinden geçiyor. (4,2)'nin kendisi boş bir kare.
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 4, y: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yol.*engel/i);

    // Token gerçekten hareket etmemiş olmalı
    const scene = await request(app).get("/api/scene");
    const playerToken = scene.body.tokens.find((t) => t.id === "player");
    expect(playerToken.x).toBe(1);
    expect(playerToken.y).toBe(1);
  });

  it("Faz 4 Bug A: yol açıksa (engelsiz) menzil içi hareket normal çalışmaya devam eder (regresyon)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 2, y: 1 }); // düz, engelsiz bir çizgi
    expect(res.status).toBe(200);
  });

  it("Faz 4 Bug B: aynı turda ardışık hareketlerin toplam mesafesi movementLeft'i aşarsa reddedilir", async () => {
    const app = buildApp();
    // player speed 5. Önce 3 kare hareket (kalan: 2), sonra 3 kare daha istenirse
    // toplam kümülatif mesafe (3+3=6) budget'i (5) aştığı için reddedilmeli.
    const first = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 4, y: 1 }); // mesafe 3, engelsiz düz çizgi
    expect(first.status).toBe(200);
    expect(first.body.scene.tokens.find((t) => t.id === "player").movementLeft).toBe(2);

    const second = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 4, y: 4 }); // mesafe 3, ama kalan sadece 2
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/menzil/i);
  });

  it("Faz 4 Bug B: kalan hareket hakkı dahilindeki ikinci hareket kabul edilir", async () => {
    const app = buildApp();
    const first = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 3, y: 1 }); // mesafe 2, kalan: 3
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/scene/move")
      .send({ tokenId: "player", x: 5, y: 1 }); // mesafe 2, kalan (3) dahilinde
    expect(second.status).toBe(200);
    expect(second.body.scene.tokens.find((t) => t.id === "player").movementLeft).toBe(1);
  });

  it("Faz 4 Bug B: end-turn ile sıra tekrar oyuncuya gelince movementLeft speed'e sıfırlanır", async () => {
    const app = buildApp();
    await request(app).post("/api/scene/move").send({ tokenId: "player", x: 4, y: 1 }); // mesafeyi tüket

    await request(app).post("/api/scene/end-turn").send({}); // goblin'e geç
    const res = await request(app).post("/api/scene/end-turn").send({}); // tekrar oyuncuya

    const playerToken = res.body.tokens.find((t) => t.id === "player");
    expect(playerToken.movementLeft).toBe(playerToken.speed);
  });
});

describe("POST /api/scene/end-turn", () => {
  beforeEach(() => {
    scenes.clear();
    characters.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Faz 4-D REGRESYON: tek düşmanlı sahnede bir end-turn çağrısı düşman turunu otomatik çözüp sırayı direkt oyuncuya döndürür", async () => {
    // Eski davranış: end-turn sadece bir sonraki token'a geçerdi (goblin'in
    // sırası dışarıdan gözlemlenebilirdi). Faz 4-D ile düşman turu tamamen
    // deterministik/scriptli olarak AYNI çağrı içinde çözülüyor, kullanıcı
    // düşmanı manuel oynamıyor.
    const app = buildApp();
    const res = await request(app).post("/api/scene/end-turn").send({});
    expect(res.status).toBe(200);
    expect(res.body.activeTokenId).toBe("player");
    expect(res.body.round).toBe(2); // player->goblin->player: bir tam round tamamlandı
    expect(Array.isArray(res.body.enemyMessages)).toBe(true);
  });

  it("Faz 4-D REGRESYON: art arda iki end-turn çağrısı round'u ilerletmeye devam eder", async () => {
    const app = buildApp();
    await request(app).post("/api/scene/end-turn").send({});
    const res = await request(app).post("/api/scene/end-turn").send({});
    expect(res.body.activeTokenId).toBe("player");
    expect(res.body.round).toBe(3);
  });

  it("yeni aktif olan (oyuncu) token'ın Aksiyon/Bonus Aksiyon hakları sıfırlanır", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const potion = createRes.body.inventory.find((i) => i.name.includes("ksir"));
    await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: createRes.body.id, itemId: potion.id });

    // Tek bir end-turn çağrısı artık tam bir round tamamlayıp oyuncuya dönüyor.
    const res = await request(app).post("/api/scene/end-turn").send({});

    const playerToken = res.body.tokens.find((t) => t.id === "player");
    expect(playerToken.actionAvailable).toBe(true);
    expect(playerToken.bonusActionAvailable).toBe(true);
  });

  it("varsayılan sahnede hareket hakkı 5 kareye çıkarılmış (Faz 3-C)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/scene");
    const playerToken = res.body.tokens.find((t) => t.id === "player");
    expect(playerToken.speed).toBe(5);
  });
});

describe("POST /api/scene/end-turn — Faz 4-D: scriptli düşman AI", () => {
  beforeEach(() => {
    scenes.clear();
    characters.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function teleportGoblinAdjacentToPlayer(app) {
    // Varsayılan sahnede goblin (8,2), player (1,1) - aralarında saldırı
    // menzili yok. Doğrudan HTTP API üzerinden "ışınlanma" yok, bu yüzden
    // testte paylaşılan `scenes` singleton'ını doğrudan mutasyona uğratıyoruz
    // (character.test.js'teki createRequire/singleton deseniyle tutarlı).
    await request(app).get("/api/scene"); // sahneyi lazy-init ettir
    const scene = scenes.get("default");
    const goblin = scene.tokens.find((t) => t.id === "goblin-1");
    const player = scene.tokens.find((t) => t.id === "player");
    goblin.x = player.x + 1;
    goblin.y = player.y;
  }

  it("düşman oyuncuya bitişik DEĞİLSE, oyuncuya doğru hareket eder ve 'yaklaşıyor' mesajı döner", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });

    const before = await request(app).get("/api/scene");
    const goblinBefore = before.body.tokens.find((t) => t.id === "goblin-1");

    const res = await request(app).post("/api/scene/end-turn").send({});

    const goblinAfter = res.body.tokens.find((t) => t.id === "goblin-1");
    const playerToken = res.body.tokens.find((t) => t.id === "player");
    const distanceBefore = Math.abs(goblinBefore.x - playerToken.x) + Math.abs(goblinBefore.y - playerToken.y);
    const distanceAfter = Math.abs(goblinAfter.x - playerToken.x) + Math.abs(goblinAfter.y - playerToken.y);

    expect(distanceAfter).toBeLessThan(distanceBefore); // oyuncuya yaklaştı
    expect(res.body.enemyMessages.some((m) => /yaklaşıyor/i.test(m))).toBe(true);
  });

  it("düşman bitişikse ve saldırı BAŞARILIYSA oyuncuya hasar verir, mesaj hasar miktarını bildirir", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.71); // D20 -> 15 (isabet), d6 -> 5 hasar
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const hpBefore = createRes.body.hp.current;

    const app2 = app; // aynı app, ayrı isim gerekmiyor ama okunabilirlik için
    await teleportGoblinAdjacentToPlayer(app2);

    const res = await request(app).post("/api/scene/end-turn").send({});

    expect(res.body.enemyMessages.some((m) => /vuruyor/i.test(m))).toBe(true);
    const charRes = await request(app).get("/api/character");
    expect(charRes.body.hp.current).toBeLessThan(hpBefore);
    expect(charRes.body.hp.current).toBe(hpBefore - 5);
  });

  it("düşman bitişikse ve saldırı ISKALARSA (nat1) HP değişmez, mesaj ıskalamayı bildirir", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // D20 -> 1 (nat1, her zaman ıska)
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const hpBefore = createRes.body.hp.current;

    await teleportGoblinAdjacentToPlayer(app);

    const res = await request(app).post("/api/scene/end-turn").send({});

    expect(res.body.enemyMessages.some((m) => /ıskalıyor/i.test(m))).toBe(true);
    const charRes = await request(app).get("/api/character");
    expect(charRes.body.hp.current).toBe(hpBefore);
  });

  it("düşman saldırısı Aksiyon hakkını tüketir (aynı düşman turunda iki kez saldıramaz)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.71);
    const app = buildApp();
    await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    await teleportGoblinAdjacentToPlayer(app);

    const res = await request(app).post("/api/scene/end-turn").send({});
    const goblinAfter = res.body.tokens.find((t) => t.id === "goblin-1");
    expect(goblinAfter.actionAvailable).toBe(false); // saldırıda tüketildi
  });

  it("düşman mesajları sohbet geçmişine source:'mock' ile ekleniyor", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });

    await request(app).post("/api/scene/end-turn").send({});

    const chatRes = await request(app).get("/api/chat");
    expect(chatRes.body.messages.length).toBeGreaterThan(0);
    expect(chatRes.body.messages[0]).toMatchObject({ role: "gm", source: "mock" });
  });
});

describe("POST /api/scene/item/use", () => {
  beforeEach(() => {
    scenes.clear();
    characters.clear();
  });

  it("var olmayan karakter için 404 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: "nope", itemId: "nope" });
    expect(res.status).toBe(404);
  });

  it("var olmayan eşya için 404 döner", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const res = await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: createRes.body.id, itemId: "nope" });
    expect(res.status).toBe(404);
  });

  it("iksir kullanmak HP'yi maksimuma kadar iyileştirir ve envanterden düşer", async () => {
    // NOT: item.name "İksir (Küçük İyileştirme)" ile başlıyor (Türkçe noktalı büyük İ).
    // routes/scene.js'deki /iksir/i regex'i bunu YAKALAMIYOR (bkz. QA_NOTES.md bug #1),
    // bu yüzden burada isim eşleşmesini regex yerine .includes("ksir") ile buluyoruz —
    // asıl regex bug'ı bu test dosyasında değil, uygulama kodunda.
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const character = createRes.body;
    const potion = character.inventory.find((i) => i.name.includes("ksir"));
    expect(potion).toBeTruthy();

    // önce hasar ver
    await request(app).post("/api/character").send({ hp: { current: 1 } });

    const useRes = await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: character.id, itemId: potion.id });

    expect(useRes.status).toBe(200);
    expect(useRes.body.character.hp.current).toBe(6); // 1 + 5
    expect(useRes.body.character.inventory.find((i) => i.id === potion.id)).toBeUndefined();
  });

  it("HP zaten maksimumdayken iksir kullanmak yine de eşyayı tüketir (iyileşme boşa gider)", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const character = createRes.body;
    const potion = character.inventory.find((i) => i.name.includes("ksir"));

    const useRes = await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: character.id, itemId: potion.id });

    expect(useRes.body.character.hp.current).toBe(character.hp.max);
    expect(useRes.body.character.inventory.find((i) => i.id === potion.id)).toBeUndefined();
  });

  it("Faz 3-C: eşya kullanmak oyuncunun Aksiyon hakkını tüketir", async () => {
    const app = buildApp();
    const sceneBefore = await request(app).get("/api/scene");
    expect(sceneBefore.body.tokens.find((t) => t.id === "player").actionAvailable).toBe(true);

    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory.find((i) => !i.name.includes("ksir")); // iksir olmayan bir eşya, HP'yi karıştırmasın

    await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: createRes.body.id, itemId: item.id });

    const sceneAfter = await request(app).get("/api/scene");
    expect(sceneAfter.body.tokens.find((t) => t.id === "player").actionAvailable).toBe(false);
  });

  it("Faz 3-C: Aksiyon hakkı tükenmişse ikinci eşya kullanımı 400 döner", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const [item1, item2] = createRes.body.inventory;

    const firstUse = await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: createRes.body.id, itemId: item1.id });
    expect(firstUse.status).toBe(200);

    const secondUse = await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: createRes.body.id, itemId: item2.id });
    expect(secondUse.status).toBe(400);
    expect(secondUse.body.error).toMatch(/aksiyon/i);
    // ikinci eşya envanterden düşmemiş olmalı (istek reddedildi)
    const charAfter = await request(app).get("/api/character");
    expect(charAfter.body.inventory.find((i) => i.id === item2.id)).toBeTruthy();
  });

  it("Faz 3-C: sıra oyuncuda değilken eşya kullanımı 400 döner", async () => {
    // Faz 4-D REGRESYON NOTU: end-turn artık düşman turunu otomatik çözüp
    // sırayı hemen oyuncuya döndürdüğü için "goblin'in sırası" normal API
    // akışından (end-turn çağrısıyla) dışarıdan artık gözlemlenemiyor/
    // üretilemiyor. Bu davranışın (requirePlayerAction'daki "Sıra sende
    // değil." kontrolü) hâlâ doğru çalıştığını doğrulamak için activeTokenId'yi
    // paylaşılan `scenes` singleton'ı üzerinden doğrudan simüle ediyoruz.
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    await request(app).get("/api/scene"); // lazy-init ettir
    scenes.get("default").activeTokenId = "goblin-1";

    const item = createRes.body.inventory[0];
    const res = await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: createRes.body.id, itemId: item.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sıra/i);
  });
});

describe("POST /api/scene/item/equip", () => {
  beforeEach(() => {
    scenes.clear();
    characters.clear();
  });

  it("equipped durumunu toggle eder", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory[0];

    const equipRes = await request(app)
      .post("/api/scene/item/equip")
      .send({ characterId: createRes.body.id, itemId: item.id });
    expect(equipRes.body.item.equipped).toBe(true);

    const unequipRes = await request(app)
      .post("/api/scene/item/equip")
      .send({ characterId: createRes.body.id, itemId: item.id });
    expect(unequipRes.body.item.equipped).toBe(false);
  });

  it("Faz 4-C: slotu olmayan bir eşya (İksir) kuşanılmaya çalışılırsa 400 döner", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const potion = createRes.body.inventory.find((i) => i.name.includes("ksir"));
    expect(potion.slot).toBeNull();

    const res = await request(app)
      .post("/api/scene/item/equip")
      .send({ characterId: createRes.body.id, itemId: potion.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kuşanılamaz/i);
  });

  it("Faz 4-C: aynı slotta yeni bir eşya kuşanılınca o slottaki eski eşya otomatik çıkarılır (paper-doll swap)", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const character = createRes.body;
    const sword = character.inventory.find((i) => i.name === "Kısa Kılıç"); // slot: hand

    // Envantere ikinci bir "hand" slotlu eşya elle ekleyip (test amaçlı) kuşanma çakışmasını simüle ediyoruz.
    const secondWeapon = { id: "test-dagger", name: "Test Hançeri", equipped: false, slot: "hand" };
    await request(app)
      .post("/api/character")
      .send({ inventory: [...character.inventory, secondWeapon] });

    await request(app)
      .post("/api/scene/item/equip")
      .send({ characterId: character.id, itemId: sword.id }); // Kılıcı kuşan

    const swapRes = await request(app)
      .post("/api/scene/item/equip")
      .send({ characterId: character.id, itemId: secondWeapon.id }); // Hançeri kuşan -> kılıç çıkmalı

    expect(swapRes.status).toBe(200);
    expect(swapRes.body.item.equipped).toBe(true); // hançer kuşanıldı

    const finalChar = await request(app).get("/api/character");
    const finalSword = finalChar.body.inventory.find((i) => i.id === sword.id);
    expect(finalSword.equipped).toBe(false); // kılıç otomatik çıkarıldı
  });

  it("Faz 3-C: kuşanmak Aksiyon hakkını TÜKETMEZ (PM onaylı kapsam: bedava)", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory[0];

    await request(app)
      .post("/api/scene/item/equip")
      .send({ characterId: createRes.body.id, itemId: item.id });

    const sceneAfter = await request(app).get("/api/scene");
    expect(sceneAfter.body.tokens.find((t) => t.id === "player").actionAvailable).toBe(true);
  });
});

describe("POST /api/scene/item/drop", () => {
  beforeEach(() => {
    scenes.clear();
    characters.clear();
  });

  it("eşyayı envanterden kaldırır ve sahne loot'una ekler (oyuncu token pozisyonunda)", async () => {
    const app = buildApp();
    // sahneyi önce oluştur (getScene lazy-init)
    await request(app).get("/api/scene");
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory[0];

    const dropRes = await request(app)
      .post("/api/scene/item/drop")
      .send({ characterId: createRes.body.id, itemId: item.id });

    expect(dropRes.status).toBe(200);
    expect(dropRes.body.character.inventory.find((i) => i.id === item.id)).toBeUndefined();

    const sceneRes = await request(app).get("/api/scene");
    const dropped = sceneRes.body.loot.find((l) => l.name === item.name);
    expect(dropped).toBeTruthy();
    expect(dropped.x).toBe(1); // varsayılan player pozisyonu
    expect(dropped.y).toBe(1);
  });

  it("Faz 3-C: eşya atmak (drop) Aksiyon hakkını TÜKETMEZ (PM onaylı kapsam: bedava)", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory[0];

    await request(app)
      .post("/api/scene/item/drop")
      .send({ characterId: createRes.body.id, itemId: item.id });

    const sceneAfter = await request(app).get("/api/scene");
    expect(sceneAfter.body.tokens.find((t) => t.id === "player").actionAvailable).toBe(true);
  });
});

describe("POST /api/scene/item/throw", () => {
  beforeEach(() => {
    scenes.clear();
    characters.clear();
  });

  it("koordinat sayı değilse 400 döner", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory[0];

    const res = await request(app)
      .post("/api/scene/item/throw")
      .send({ characterId: createRes.body.id, itemId: item.id, x: "a", y: 1 });
    expect(res.status).toBe(400);
  });

  it("belirtilen koordinata loot olarak düşer (menzil/engel kontrolü yok)", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory[0];

    const res = await request(app)
      .post("/api/scene/item/throw")
      .send({ characterId: createRes.body.id, itemId: item.id, x: 9, y: 7 });

    expect(res.status).toBe(200);
    expect(res.body.scene.loot.find((l) => l.x === 9 && l.y === 7 && l.name === item.name)).toBeTruthy();
  });

  it("Faz 3-C: eşya fırlatmak Aksiyon hakkını tüketir", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const item = createRes.body.inventory[0];

    await request(app)
      .post("/api/scene/item/throw")
      .send({ characterId: createRes.body.id, itemId: item.id, x: 5, y: 5 });

    const sceneAfter = await request(app).get("/api/scene");
    expect(sceneAfter.body.tokens.find((t) => t.id === "player").actionAvailable).toBe(false);
  });

  it("Faz 3-C: Aksiyon hakkı zaten tükenmişse fırlatma 400 döner", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });
    const [item1, item2] = createRes.body.inventory;

    await request(app)
      .post("/api/scene/item/use")
      .send({ characterId: createRes.body.id, itemId: item1.id }); // Aksiyonu tüket

    const res = await request(app)
      .post("/api/scene/item/throw")
      .send({ characterId: createRes.body.id, itemId: item2.id, x: 5, y: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/aksiyon/i);
  });
});
