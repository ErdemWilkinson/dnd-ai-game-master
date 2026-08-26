import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// bkz. chat.test.js/scene.test.js: require() ile aynı CJS module cache'ini
// kullanmak gerekiyor, aksi halde store.js/freeformEncounter.js singleton'ları
// testte ayrı bir kopya olarak yüklenir ve clear()/reset() gerçek router
// state'ini etkilemez.
const require = createRequire(import.meta.url);
const chatRouter = require("../routes/chat.js");
const characterRouter = require("../routes/character.js");
const { chatHistories, characters, scenes, activeCharacterIdBySession } = require("../data/store.js");
const { DEFAULT_SESSION_ID } = require("../services/sessionId.js");
const { getFreeformEncounter, advanceFreeformEncounter, resetFreeformEncounter } = require("../services/freeformEncounter.js");
const { ENCOUNTERS } = require("../data/encounters.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRouter);
  app.use("/api/character", characterRouter);
  return app;
}

async function createFighter(app) {
  const res = await request(app)
    .post("/api/character/create")
    .send({ name: "Kahraman", raceId: "human", classId: "fighter" });
  return res.body;
}

describe("Faz 12-A: /chat serbest metinden GERÇEK mekanik sonuç (saldırı/eşya)", () => {
  beforeEach(() => {
    chatHistories.clear();
    characters.clear();
    scenes.clear();
    activeCharacterIdBySession.clear();
    resetFreeformEncounter(DEFAULT_SESSION_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saldırı niyeti algılanınca aktif düşmana GERÇEKTEN hasar uygular (HP gerçekten düşer)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // yüksek isabet ihtimali (D20 -> 19)
    const app = buildApp();
    await createFighter(app);

    const before = getFreeformEncounter(DEFAULT_SESSION_ID);
    const goblinBefore = before.enemies.find((e) => e.id === "goblin-1");
    expect(goblinBefore).toBeTruthy();
    const hpBefore = goblinBefore.hp;

    const res = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.roll).toMatchObject({ attribute: "str", dc: 12 }); // fighter primary: str

    const after = getFreeformEncounter(DEFAULT_SESSION_ID);
    const goblinAfter = after.enemies.find((e) => e.id === "goblin-1");
    expect(goblinAfter.hp).toBeLessThan(hpBefore);
    expect(res.body.gmMessage.text).toMatch(/hasar verdin/);
  });

  it("düşman yenilince karakter gerçekten XP kazanır ve karşılaşma bir sonrakine geçer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // maksimum isabet + hasar, kritikler dahil
    const app = buildApp();
    const character = await createFighter(app);
    expect(character.xp).toBe(0);

    let cleared = false;
    // Goblin'in HP'sini (10) sıfıra indirmek için gerektiği kadar saldır -
    // tam hasar sayısını sabitlemek yerine (silah/kritik matematiğine bağlı,
    // kırılgan) döngüyle gerçekten yenilene kadar deniyoruz.
    let lastRes;
    for (let i = 0; i < 10 && !cleared; i++) {
      lastRes = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
      if (lastRes.body.gmMessage.text.includes("yenildi")) cleared = true;
    }

    expect(cleared).toBe(true);
    expect(lastRes.body.gmMessage.text).toMatch(/Alanı temizledin! Yeni alan:/);

    const updatedCharacter = characters.get(character.id);
    // XP_PER_KILL=20, xpToNextLevel(1)=50 - tek bir kill ile seviye atlamaz,
    // ama xp alanı gerçekten 0'dan 20'ye güncellenmiş olmalı.
    expect(updatedCharacter.xp).toBe(20);

    const state = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(state.encounterIndex).toBe(1); // bir sonraki karşılaşmaya geçti
    expect(state.enemies.length).toBeGreaterThan(0); // yeni karşılaşmanın düşmanları yüklendi
  });

  it("İnovasyon fikri #87: tüm karşılaşma havuzu bir kez turlanınca özel bir 'Tüm bölgeyi temizledin' anı yaşatır (grid'in checkEncounterCleared()'ıyla aynı davranış)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const app = buildApp();
    await createFighter(app);

    // Havuzdaki SON karşılaşmaya kadar ilerlet (index ENCOUNTERS.length-1) -
    // bu karşılaşma temizlenince (index+1) % length === 0 olacak.
    for (let i = 0; i < ENCOUNTERS.length - 1; i++) {
      advanceFreeformEncounter(DEFAULT_SESSION_ID);
    }
    expect(getFreeformEncounter(DEFAULT_SESSION_ID).encounterIndex).toBe(ENCOUNTERS.length - 1);

    let lastRes;
    let cleared = false;
    for (let i = 0; i < 10 && !cleared; i++) {
      lastRes = await request(app).post("/api/chat").send({ message: "Düşmana saldırıyorum" });
      if (lastRes.body.gmMessage.text.includes("yenildi")) cleared = true;
    }

    expect(cleared).toBe(true);
    expect(lastRes.body.gmMessage.text).toMatch(/Tüm bölgeyi temizledin!/);
    // Normal ("Alanı temizledin! Yeni alan:") mesajı DEĞİL, özel tam-tur mesajı gösterilmeli.
    expect(lastRes.body.gmMessage.text).not.toContain("Alanı temizledin! Yeni alan:");

    const stateAfter = getFreeformEncounter(DEFAULT_SESSION_ID);
    // encounterIndex sonsuza kadar artan bir sayaç (grid'in sceneFactory.js'iyle
    // aynı desen) - içerik seçimi (name/enemies) % ENCOUNTERS.length ile
    // sarılıyor, ama alanın kendisi sarılmıyor.
    expect(stateAfter.encounterIndex).toBe(ENCOUNTERS.length);
    expect(stateAfter.name).toBe(ENCOUNTERS[0].name); // içerik başa sardı
  });

  it("eşya kullanma niyeti algılanınca envanterdeki iksir GERÇEKTEN tüketilip HP iyileştiriyor", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const potion = character.inventory.find((i) => i.name.includes("İksir"));
    expect(potion).toBeTruthy();

    // Önce hasar alsın ki iyileşme gözlemlenebilsin.
    const stored = characters.get(character.id);
    stored.hp.current = Math.max(1, stored.hp.max - 5);
    const hpBefore = stored.hp.current;

    const res = await request(app).post("/api/chat").send({ message: "İksiri içiyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.hp.current).toBeGreaterThan(hpBefore);
    expect(updated.inventory.find((i) => i.id === potion.id)).toBeUndefined();
    expect(res.body.gmMessage.text).toMatch(/kullanıldı.*HP iyileştirdin/);
  });

  it("eşya alma niyeti algılanınca sahnedeki loot GERÇEKTEN envantere ekleniyor", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const inventoryCountBefore = character.inventory.length;

    const stateBefore = getFreeformEncounter(DEFAULT_SESSION_ID);
    const lootCountBefore = stateBefore.loot.length;
    expect(lootCountBefore).toBeGreaterThan(0);

    const res = await request(app).post("/api/chat").send({ message: "Yerdeki eşyayı alıyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.inventory.length).toBe(inventoryCountBefore + 1);
    const stateAfter = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(stateAfter.loot.length).toBe(lootCountBefore - 1);
    expect(res.body.gmMessage.text).toMatch(/envanterine eklendi/);
  });

  it("aktif karakter yoksa saldırı/eşya niyeti tespit edilse bile hiçbir mekanik sonuç üretmez (eski davranış korunur)", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/hasar verdin|yenildi/);
  });

  it("/character/reset serbest-form düşman/loot state'ini de sıfırlar (bir sonraki karakter baştan Terk Edilmiş Mahzen ile başlar)", async () => {
    const app = buildApp();
    await createFighter(app);
    const state = getFreeformEncounter(DEFAULT_SESSION_ID);
    state.encounterIndex = 3; // ilerlemiş gibi simüle et

    await request(app).post("/api/character/reset");

    const freshState = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(freshState.encounterIndex).toBe(0);
    expect(freshState.name).toBe("Terk Edilmiş Mahzen");
  });

  it("düşman yokken (karşılaşma temizlendikten sonra) saldırı niyeti sessizce hiçbir mekanik sonuç üretmez", async () => {
    const app = buildApp();
    await createFighter(app);
    const state = getFreeformEncounter(DEFAULT_SESSION_ID);
    state.enemies = []; // tüm düşmanlar zaten temizlenmiş gibi simüle et

    const res = await request(app).post("/api/chat").send({ message: "Boşluğa saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/hasar verdin|yenildi/);
  });

  it("mevcut grid endpoint'lerine dokunulmadı - grid'in KENDİ goblin token'ının HP'si serbest-form saldırısından etkilenmez", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = buildApp();
    await createFighter(app);
    // /chat, anlatım bağlamı için getScene() çağırır - bu çağrı grid sahnesini
    // (data/store.js: scenes) lazy oluşturur ama HİÇ mutasyona uğratmamalı.
    await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });

    const gridScene = scenes.get(DEFAULT_SESSION_ID);
    const gridGoblin = gridScene.tokens.find((t) => t.id === "goblin-1");
    expect(gridGoblin.hp).toBe(gridGoblin.maxHp); // hiç hasar almamış - grid tamamen ayrı kaldı
  });
});
