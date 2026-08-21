import { describe, it, expect, beforeEach } from "vitest";
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
  it("races ve classes dizilerini döner", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/character/options");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.races)).toBe(true);
    expect(Array.isArray(res.body.classes)).toBe(true);
    expect(res.body.races.length).toBeGreaterThan(0);
    expect(res.body.classes.length).toBeGreaterThan(0);
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

  it("insan ırkı tüm attribute'lara +1 bonus uygular", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/character/create")
      .send({ name: "Test", raceId: "human", classId: "fighter" });

    expect(res.body.attributes).toMatchObject({
      str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11,
    });
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
