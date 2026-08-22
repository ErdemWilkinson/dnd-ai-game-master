import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// Backend CommonJS (require/module.exports) kullanıyor. ESM `import` ile aynı
// dosyayı çekmek, Node'un require cache'inden AYRI bir modül kopyası oluşturur
// (vite-node'un ESM transformu ile native CJS loader farklı kayıtlar tutar).
// Bu da route dosyasının kullandığı `characters` Map'i ile test dosyasındakinin
// FARKLI nesneler olmasına yol açar (bkz. tester notu: "store singleton
// dual-instance" bulgusu). createRequire ile router.js'in require ettiği aynı
// CJS cache'i kullanmak zorunludur.
const require = createRequire(import.meta.url);
const characterRouter = require("../routes/character.js");
const { characters } = require("../data/store.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/character", characterRouter);
  return app;
}

describe("GET /api/character/options", () => {
  it("races, classes ve appearances dizilerini döner", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/character/options");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.races)).toBe(true);
    expect(Array.isArray(res.body.classes)).toBe(true);
    expect(Array.isArray(res.body.appearances)).toBe(true);
    expect(res.body.races.length).toBeGreaterThan(0);
    expect(res.body.classes.length).toBeGreaterThan(0);
    expect(res.body.appearances.length).toBeGreaterThan(0);
  });
});

describe("POST /api/character/roll-stats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("geçersiz raceId için 400 döner", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/character/roll-stats").send({ raceId: "orc-lord" });
    expect(res.status).toBe(400);
  });

  it("geçerli raceId ile D20 zarları + ırk bonusu uygulanmış attributes döner", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // D20 -> 11 her attribute
    const app = buildApp();
    const res = await request(app).post("/api/character/roll-stats").send({ raceId: "elf" });

    expect(res.status).toBe(200);
    expect(res.body.rolls).toMatchObject({
      str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11,
    });
    // Elf bonusu: dex +2, int +1 (bkz. data/dnd.js)
    expect(res.body.attributes).toMatchObject({
      str: 11, dex: 13, con: 11, int: 12, wis: 11, cha: 11,
    });
  });

  it("her çağrıda D20 aralığında (1-20) rastgele değerler döner (gerçek RNG ile)", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/character/roll-stats").send({ raceId: "human" });

    expect(res.status).toBe(200);
    for (const value of Object.values(res.body.rolls)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(20);
    }
  });
});

describe("POST /api/character/create", () => {
  beforeEach(() => {
    characters.clear();
  });

  it("valid ırk/sınıf/isim ile 201 ve karakter döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "Aragorn", raceId: "human", classId: "fighter" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Aragorn",
      race: "human",
      class: "fighter",
      level: 1,
    });
    expect(res.body.id).toBeTruthy();
    expect(res.body.hp.current).toBe(res.body.hp.max);
    expect(Array.isArray(res.body.inventory)).toBe(true);
    expect(res.body.inventory.length).toBeGreaterThan(0);
  });

  it("Faz 4-C: her envanter eşyasına doğru ekipman slotu atanır (Faz 5-3: SS13 slot adları)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "Aragorn", raceId: "human", classId: "fighter" });

    const sword = res.body.inventory.find((i) => i.name === "Kısa Kılıç");
    const armor = res.body.inventory.find((i) => i.name === "Deri Zırh");
    const potion = res.body.inventory.find((i) => i.name.includes("ksir"));

    expect(sword.slot).toBe("hand");
    expect(armor.slot).toBe("suit");
    expect(potion.slot).toBeNull();
    // Her eşyanın slot alanı var (undefined değil, açıkça null ya da bir string)
    for (const item of res.body.inventory) {
      expect(item).toHaveProperty("slot");
    }
  });

  it("Faz 5-3: her envanter eşyasına slotuna göre icon alanı atanır (hand hariç, ikon yok)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "Aragorn", raceId: "human", classId: "fighter" });

    const armor = res.body.inventory.find((i) => i.name === "Deri Zırh");
    const sword = res.body.inventory.find((i) => i.name === "Kısa Kılıç");
    const potion = res.body.inventory.find((i) => i.name.includes("ksir"));

    expect(armor.icon).toBe("/icons/suit.png");
    expect(sword.icon).toBeNull(); // hand slotu için asset setinde ikon yok
    expect(potion.icon).toBeNull(); // slotu yok, ikonu da yok
  });

  it("attributes gönderilmeden istek atılırsa sunucu kendi D20 zarını atar ve ırk bonusunu uygular", async () => {
    // Faz 3-A: stat ataması artık D20 zarla belirleniyor. `attributes` body'de
    // yoksa (veya geçersizse) server kendi zarını atıp ırk bonusunu uyguluyor.
    // Math.random'ı sabitleyerek D20 sonucunu deterministik hale getiriyoruz:
    // floor(0.5 * 20) + 1 = 11 her attribute için, insan ırkı +1 bonus -> 12.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      const app = buildApp();
      const res = await request(app)
        .post("/api/character/create")
        .send({ name: "Test", raceId: "human", classId: "fighter" });

      expect(res.body.attributes).toMatchObject({
        str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12,
      });
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("geçerli attributes gönderilirse sunucu zar atmaz, gönderilen değerler aynen kullanılır", async () => {
    const randomSpy = vi.spyOn(Math, "random");
    try {
      const app = buildApp();
      const providedAttributes = { str: 18, dex: 8, con: 14, int: 6, wis: 10, cha: 16 };
      const res = await request(app)
        .post("/api/character/create")
        .send({ name: "Test", raceId: "human", classId: "fighter", attributes: providedAttributes });

      expect(res.status).toBe(201);
      // Bonus UYGULANMAZ: /roll-stats zaten bonus uygulanmış sonucu döndürüyor,
      // /create bunun üzerine ikinci kez ırk bonusu eklemez.
      expect(res.body.attributes).toEqual(providedAttributes);
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("eksik/kısmi attributes gönderilirse geçersiz sayılıp sunucu kendi zarını atar", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter", attributes: { str: 15 } });

    expect(res.status).toBe(201);
    // Tüm ATTRIBUTE_KEYS dolu olmalı (server fallback zarı devreye girdi)
    expect(Object.keys(res.body.attributes).sort()).toEqual(
      ["cha", "con", "dex", "int", "str", "wis"],
    );
  });

  it("isim boşsa 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "", raceId: "human", classId: "fighter" });
    expect(res.status).toBe(400);
  });

  it("isim sadece boşluklardan oluşuyorsa 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "   ", raceId: "human", classId: "fighter" });
    expect(res.status).toBe(400);
  });

  it("isim eksikse 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ raceId: "human", classId: "fighter" });
    expect(res.status).toBe(400);
  });

  it("geçersiz raceId için 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "orc-lord", classId: "fighter" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ırk/i);
  });

  it("geçersiz classId için 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "necromancer" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sınıf/i);
  });

  it("body tamamen boşsa (undefined) çökmeden 400 döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .set("Content-Type", "application/json")
      .send();
    expect(res.status).toBe(400);
  });

  it("yeni karakter oluşturmak 'aktif karakteri' değiştirir", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/character/create")
      .send({ name: "Birinci", raceId: "human", classId: "fighter" });
    const second = await request(app)
      .post("/api/character/create")
      .send({ name: "İkinci", raceId: "elf", classId: "rogue" });

    const activeRes = await request(app).get("/api/character");
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.id).toBe(second.body.id);
    expect(activeRes.body.name).toBe("İkinci");
  });
});

describe("GET /api/character (aktif karakter)", () => {
  beforeEach(() => {
    characters.clear();
  });

  it("hiç karakter oluşturulmadıysa 404 döner", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/character");
    expect(res.status).toBe(404);
  });

  it("oluşturulan karakteri aktif karakter olarak döner", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Legolas", raceId: "elf", classId: "rogue" });

    const getRes = await request(app).get("/api/character");
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
    expect(getRes.body.name).toBe("Legolas");
  });
});

describe("POST /api/character (aktif karakteri güncelle)", () => {
  beforeEach(() => {
    characters.clear();
  });

  it("aktif karakter yoksa 404 döner", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/character").send({ hp: { current: 1 } });
    expect(res.status).toBe(404);
  });

  it("hp kısmi güncellemesi diğer alanları korur", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Gimli", raceId: "dwarf", classId: "fighter" });
    const maxHp = createRes.body.hp.max;

    const updateRes = await request(app)
      .post("/api/character")
      .send({ hp: { current: 1 } });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.hp.current).toBe(1);
    expect(updateRes.body.hp.max).toBe(maxHp);
    expect(updateRes.body.id).toBe(createRes.body.id);
  });
});

describe("GET /api/character/:id", () => {
  beforeEach(() => {
    characters.clear();
  });

  it("var olmayan id için 404 döner", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/character/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("oluşturulan karakteri id ile getirir", async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post("/api/character/create")
      .send({ name: "Legolas", raceId: "elf", classId: "rogue" });
    const id = createRes.body.id;

    const getRes = await request(app).get(`/api/character/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe("Legolas");
  });

  it("'options' path'i :id route'una düşmemeli (route sırası çakışması)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/character/options");
    expect(res.status).toBe(200);
    expect(res.body.races).toBeDefined();
  });
});
