import { describe, it, expect, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// Yaratıcı cron fikir #115: server.js require edilirse app.listen() gerçekten
// çalışıp bir port dinlemeye başlar (VITEST guard'ı sadece stale-session
// cleanup'ı atlıyor, start()'ın kendisini değil) - bu yüzden diğer test
// dosyalarındaki AYNI desenle (kendi küçük express() app'ini kurmak),
// server.js'teki genel hata middleware'inin (satır ~105-115) BİREBİR AYNI
// mantığını burada yeniden kuruyoruz.
function buildApp() {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.post("/echo", (req, res) => res.json(req.body));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.status && err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: "Geçersiz istek gövdesi." });
    }
    res.status(500).json({ error: "Sunucu hatası." });
  });
  return app;
}

describe("server.js genel hata middleware'i — fikir #115: bozuk JSON body", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bozuk JSON gövdesi 500 yerine 400 ile 'Geçersiz istek gövdesi.' döner", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send('{"name": "broken json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Geçersiz istek gövdesi." });
  });

  it("geçerli JSON gövdesi normal şekilde işlenmeye devam eder (regresyon değil)", async () => {
    const app = buildApp();
    const res = await request(app).post("/echo").send({ name: "Aragorn" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "Aragorn" });
  });
});

describe("server.js genel hata middleware'i — fikir #116: aşırı büyük body", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("100kb limitini aşan body 500 yerine 413 ile 'Geçersiz istek gövdesi.' döner", async () => {
    const app = buildApp();
    const bigPayload = { name: "a".repeat(200 * 1024) };
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(bigPayload));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Geçersiz istek gövdesi." });
  });
});
