import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// Faz 6-A: oturum izolasyonu. İki farklı X-Session-Id ile gelen isteklerin
// birbirinin karakter/sahne/sohbetini hiç görmediğini/etkilemediğini
// doğrulayan kritik test seti. bkz. character.test.js'teki CJS/ESM
// tekilleştirme notuyla aynı createRequire deseni.
const require = createRequire(import.meta.url);
const characterRouter = require("../routes/character.js");
const sceneRouter = require("../routes/scene.js");
const chatRouter = require("../routes/chat.js");
const { characters, chatHistories, scenes, activeCharacterIdBySession } = require("../data/store.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/character", characterRouter);
  app.use("/api/scene", sceneRouter);
  app.use("/api/chat", chatRouter);
  return app;
}

function withSession(app, sessionId) {
  return {
    get: (url) => request(app).get(url).set("X-Session-Id", sessionId),
    post: (url) => request(app).post(url).set("X-Session-Id", sessionId),
  };
}

const SESSION_A = "session-a-11111";
const SESSION_B = "session-b-22222";

beforeEach(() => {
  characters.clear();
  chatHistories.clear();
  scenes.clear();
  activeCharacterIdBySession.clear();
});

describe("Faz 6-A: oturum izolasyonu — karakter", () => {
  it("iki farklı sessionId farklı 'aktif karakter' üretir, birbirini görmez", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    const createB = await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });

    expect(createA.body.name).toBe("Aragorn");
    expect(createB.body.name).toBe("Gimli");
    expect(createA.body.id).not.toBe(createB.body.id);

    const getA = await a.get("/api/character");
    const getB = await b.get("/api/character");
    expect(getA.body.name).toBe("Aragorn");
    expect(getB.body.name).toBe("Gimli");
  });

  it("session A'nın karakterini güncellemek session B'nin aktif karakterini ETKİLEMEZ", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    const createB = await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });
    const bMaxHp = createB.body.hp.max;

    await a.post("/api/character").send({ hp: { current: 1 } });

    const getB = await b.get("/api/character");
    expect(getB.body.hp.current).toBe(bMaxHp); // A'nın güncellemesi B'yi etkilememeli
  });

  it("iki session ART ARDA karakter oluşturursa, ikisi de kendi karakterini 'aktif' olarak görmeye devam eder (eski global-son-oluşturulan-karakter davranışı yok)", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" }); // B, A'DAN SONRA oluşturuluyor

    const getA = await a.get("/api/character");
    expect(getA.body.id).toBe(createA.body.id); // A hâlâ kendi karakterini görmeli, B'ninkini değil
    expect(getA.body.name).toBe("Aragorn");
  });

  it("X-Session-Id header'ı gönderilmezse 'default' oturumuna düşer (geriye dönük uyumluluk)", async () => {
    const app = buildApp();
    // header YOK - eski davranış
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Legacy", raceId: "human", classId: "fighter" });
    const getRes = await request(app).get("/api/character");
    expect(getRes.body.name).toBe("Legacy");
  });
});

describe("Faz 6-A: oturum izolasyonu — sahne (scene)", () => {
  it("her session kendi sahnesine sahiptir, biri hareket edince diğerinin sahnesi değişmez", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });

    const sceneBBefore = await b.get("/api/scene");
    const goblinBBefore = sceneBBefore.body.tokens.find((t) => t.id === "goblin-1");

    // A'nın oyuncu token'ını hareket ettir
    await a.post("/api/scene/move").send({ tokenId: "player", x: 2, y: 1 });

    const sceneA = await a.get("/api/scene");
    const sceneBAfter = await b.get("/api/scene");
    const playerAAfter = sceneA.body.tokens.find((t) => t.id === "player");
    const playerBAfter = sceneBAfter.body.tokens.find((t) => t.id === "player");

    expect(playerAAfter.x).toBe(2); // A'nın hareketi kendi sahnesine yansıdı
    expect(playerBAfter.x).toBe(1); // B'nin sahnesi varsayılan konumda kaldı, ETKİLENMEDİ
    const goblinBAfter = sceneBAfter.body.tokens.find((t) => t.id === "goblin-1");
    expect(goblinBAfter.x).toBe(goblinBBefore.x); // B'nin düşmanı da değişmedi
  });

  it("session A'da 'Turu Bitir' çağrısı session B'nin sahnesindeki turu/round'u etkilemez", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });

    await a.post("/api/scene/end-turn").send({});

    const sceneB = await b.get("/api/scene");
    expect(sceneB.body.round).toBe(1); // B hâlâ round 1'de, A'nın end-turn'ü B'yi etkilemedi
  });
});

describe("Faz 6-A: oturum izolasyonu — sohbet", () => {
  it("session A'nın gönderdiği mesaj session B'nin sohbet geçmişinde GÖRÜNMEZ", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });

    await a.post("/api/chat").send({ message: "Merhaba, ben A." });

    const chatA = await a.get("/api/chat");
    const chatB = await b.get("/api/chat");

    expect(chatA.body.messages.length).toBeGreaterThan(0);
    expect(chatB.body.messages).toHaveLength(0); // B'nin sohbeti tamamen boş kalmalı
  });

  it("sohbetteki GM anlatımı, ilgili session'ın KENDİ aktif karakterine göre üretiliyor (actionResolver doğru karakteri kullanıyor)", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" }); // primary: str
    await b.post("/api/character/create").send({ name: "Merlin", raceId: "elf", classId: "wizard" }); // primary: int

    const chatA = await a.post("/api/chat").send({ message: "goblin'e saldırıyorum" });

    // A'nın karakteri fighter (str primary) olduğu için zar A'nın karakterine göre atılmalı
    expect(chatA.body.gmMessage.roll.attribute).toBe("str");
  });
});

describe("Faz 6-A: rate limiter kasıtlı olarak GLOBAL kalmalı (PM kararı)", () => {
  it("rate limiter modülü sessionId parametresi almıyor (session-başına değil, uygulama-geneli)", () => {
    const rateLimiter = require("../services/rateLimiter.js");
    // allowRequest()'in imzası hâlâ parametresiz - sessionId'ye göre ayrı
    // kota tutmuyor, PM'in Faz 6 notuyla tutarlı.
    expect(rateLimiter.allowRequest.length).toBe(0);
  });
});

describe("Faz 6-B güvenlik takibi: characterId sahiplik doğrulaması (commit 309cb89)", () => {
  // REGRESYON NOTU: bu describe eskiden "characterId sahiplik doğrulaması
  // YOK" tasarım notunu belgeliyordu (tester bulgusu, Faz 6-A). Coder bunu
  // Faz 6-B'de requireOwnedCharacter() helper'ıyla kapattı - artık başka bir
  // session'ın characterId'sini "bilmek" tek başına erişim için yetmiyor.

  it("session B, session A'nın characterId'siyle item/equip çağırırsa 403 döner", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    const item = createA.body.inventory[0];

    const res = await b.post("/api/scene/item/equip").send({ characterId: createA.body.id, itemId: item.id });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/erişim yetkin yok/i);

    // Ve gerçekten hiçbir şey değişmemiş olmalı
    const stillA = await a.get("/api/character");
    expect(stillA.body.inventory.find((i) => i.id === item.id).equipped).toBe(false);
  });

  it.each(["item/use", "item/equip", "item/drop", "item/throw"])(
    "%s endpoint'i de başka session'ın characterId'sini 403 ile reddeder",
    async (endpoint) => {
      const app = buildApp();
      const a = withSession(app, SESSION_A);
      const b = withSession(app, SESSION_B);

      const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
      const item = createA.body.inventory[0];

      const res = await b.post(`/api/scene/${endpoint}`).send({ characterId: createA.body.id, itemId: item.id, x: 1, y: 1 });
      expect(res.status).toBe(403);
    },
  );

  it("/scene/attack de aynı kontrolden geçer (başka session'ın characterId'si 403)", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });

    const res = await b.post("/api/scene/attack").send({ characterId: createA.body.id, targetTokenId: "goblin-1" });
    expect(res.status).toBe(403);
  });

  it("/character/intro de aynı kontrolden geçer", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });

    const res = await b.post("/api/character/intro").send({ characterId: createA.body.id });
    expect(res.status).toBe(403);
  });

  it("sahip kendi characterId'siyle çağırınca normal çalışmaya devam eder (regresyon değil)", async () => {
    const app = buildApp();
    const a = withSession(app, SESSION_A);

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    const item = createA.body.inventory[0];

    const res = await a.post("/api/scene/item/equip").send({ characterId: createA.body.id, itemId: item.id });
    expect(res.status).toBe(200);
    expect(res.body.item.equipped).toBe(true);
  });

  it("var olmayan bir characterId ile çağrılırsa (hiç kimseye ait değil) 404 döner, 403 değil", async () => {
    const app = buildApp();
    const b = withSession(app, SESSION_B);

    const res = await b.post("/api/scene/item/equip").send({ characterId: "does-not-exist", itemId: "nope" });
    expect(res.status).toBe(404);
  });
});
