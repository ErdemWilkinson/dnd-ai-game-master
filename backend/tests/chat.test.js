import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// bkz. character.test.js: require() ile aynı CJS module cache'ini kullanmak
// gerekiyor, aksi halde store.js singleton'ı testte ayrı bir kopya olarak
// yüklenir ve clear() gerçek router state'ini etkilemez.
const require = createRequire(import.meta.url);
const chatRouter = require("../routes/chat.js");
const { chatHistories } = require("../data/store.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRouter);
  return app;
}

describe("GET /api/chat", () => {
  beforeEach(() => {
    chatHistories.clear();
  });

  it("hiç mesaj yoksa boş dizi döner", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/chat");
    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
  });
});

describe("POST /api/chat", () => {
  beforeEach(() => {
    chatHistories.clear();
  });

  it("boş mesaj için 400 döner", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "" });
    expect(res.status).toBe(400);
  });

  it("sadece boşluk mesajı için 400 döner", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "   " });
    expect(res.status).toBe(400);
  });

  it("mesaj alanı eksikse 400 döner", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({});
    expect(res.status).toBe(400);
  });

  it("geçerli mesaj için 201 ve player+gm mesajları döner", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "Merhaba" });
    expect(res.status).toBe(201);
    expect(res.body.playerMessage).toMatchObject({ role: "player", text: "Merhaba" });
    expect(res.body.gmMessage).toMatchObject({ role: "gm" });
    expect(typeof res.body.gmMessage.text).toBe("string");
    expect(res.body.gmMessage.text.length).toBeGreaterThan(0);
  });

  it("mesaj baştaki/sondaki boşluklardan trim edilir", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "  merhaba  " });
    expect(res.body.playerMessage.text).toBe("merhaba");
  });

  it("saldırı anahtar kelimesi ATTACK havuzundan cevap üretir", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "goblin'e saldır" });
    expect(res.body.gmMessage.text).toMatch(/(Silahını|Ani bir hamle|Saldırın)/);
  });

  it("mesajlar geçmişe (history) eklenir ve GET ile görünür", async () => {
    const app = buildApp();
    await request(app).post("/api/chat").send({ message: "ilk mesaj" });
    await request(app).post("/api/chat").send({ message: "ikinci mesaj" });

    const getRes = await request(app).get("/api/chat");
    // her post 2 mesaj ekler (player + gm) -> 2 post = 4 mesaj
    expect(getRes.body.messages.length).toBe(4);
    expect(getRes.body.messages[0].text).toBe("ilk mesaj");
    expect(getRes.body.messages[2].text).toBe("ikinci mesaj");
  });

  it("mesaj string değilse (örn. sayı) 400 döner", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: 12345 });
    expect(res.status).toBe(400);
  });
});
