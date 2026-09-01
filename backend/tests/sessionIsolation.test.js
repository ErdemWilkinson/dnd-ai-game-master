import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// Faz 6-A: oturum izolasyonu. İki farklı X-Session-Id ile gelen isteklerin
// birbirinin karakter/sohbetini hiç görmediğini/etkilemediğini doğrulayan
// kritik test seti. bkz. character.test.js'teki CJS/ESM tekilleştirme
// notuyla aynı createRequire deseni.
const require = createRequire(import.meta.url);
const characterRouter = require("../routes/character.js");
const chatRouter = require("../routes/chat.js");
const { characters, chatHistories, activeCharacterIdBySession } = require("../data/store.js");
const { getFreeformEncounter, resetFreeformEncounter } = require("../services/freeformEncounter.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/character", characterRouter);
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

    const createA = await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    const createB = await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });
    const bMaxHp = createB.body.hp.max;

    // Yaratıcı cron fikir #29: POST /api/character kaldırıldı, doğrudan store üzerinden.
    characters.get(createA.body.id).hp.current = 1;

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

  it("X-Session-Id header'ı gönderilmezse sabit bir fallback oturumuna düşer (geriye dönük uyumluluk, fikir #62'den sonra artık tahmin edilemez bir UUID)", async () => {
    const app = buildApp();
    // header YOK - eski davranış
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Legacy", raceId: "human", classId: "fighter" });
    const getRes = await request(app).get("/api/character");
    expect(getRes.body.name).toBe("Legacy");
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

describe("Faz 12: oturum izolasyonu — freeform karşılaşma", () => {
  // Yaratıcı cron fikir #112: grid kaldırılırken (6ac6291) eski "sahne
  // izolasyonu" testi de silinmişti, ama freeform'un `freeformEncounters`
  // Map'i (kod olarak sessionId'ye göre anahtarlanmış, freeformEncounter.js)
  // için eşdeğer bir davranış testi hiç eklenmemişti - kod doğru görünüyordu
  // ama hiç doğrulanmamıştı. freeformCombat.test.js'deki yüksek-isabet
  // mock'uyla AYNI teknik kullanılıyor.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("session A'nın düşmana verdiği hasar session B'nin karşılaşma state'ini ETKİLEMEZ", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // yüksek isabet ihtimali (D20 -> 19)
    resetFreeformEncounter(SESSION_A);
    resetFreeformEncounter(SESSION_B);

    const app = buildApp();
    const a = withSession(app, SESSION_A);
    const b = withSession(app, SESSION_B);

    await a.post("/api/character/create").send({ name: "Aragorn", raceId: "human", classId: "fighter" });
    await b.post("/api/character/create").send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });

    const goblinBBefore = getFreeformEncounter(SESSION_B).enemies.find((e) => e.id === "goblin-1");
    const hpBBefore = goblinBBefore.hp;

    const resA = await a.post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(resA.status).toBe(201);

    const goblinAAfter = getFreeformEncounter(SESSION_A).enemies.find((e) => e.id === "goblin-1");
    expect(goblinAAfter.hp).toBeLessThan(hpBBefore); // A'nın saldırısı kendi düşmanına işledi

    const goblinBAfter = getFreeformEncounter(SESSION_B).enemies.find((e) => e.id === "goblin-1");
    expect(goblinBAfter.hp).toBe(hpBBefore); // B'ninki A'nın saldırısından hiç etkilenmedi
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
  // Faz 12-C (grid kaldırıldı): bu kontrolü kullanan grid route'ları
  // (scene.js: item/*, attack) tamamen silindi - /chat hiçbir zaman
  // characterId body parametresi kabul etmiyor (sadece session'ın aktif
  // karakterini kullanıyor), bu yüzden bu IDOR sınıfı freeform'da yapısal
  // olarak mümkün değil. `/character/intro` hâlâ characterId alan tek route,
  // testi orada kalıyor.

  it("/character/intro, başka session'ın characterId'sini 403 ile reddeder", async () => {
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

    const res = await a.post("/api/character/intro").send({ characterId: createA.body.id });
    expect(res.status).toBe(200);
  });

  it("var olmayan bir characterId ile çağrılırsa (hiç kimseye ait değil) 404 döner, 403 değil", async () => {
    const app = buildApp();
    const b = withSession(app, SESSION_B);

    const res = await b.post("/api/character/intro").send({ characterId: "does-not-exist" });
    expect(res.status).toBe(404);
  });
});
