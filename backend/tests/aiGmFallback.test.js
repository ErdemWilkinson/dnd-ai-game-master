import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// NOT: Bu backend'de vi.mock("../services/aiGm.js") İŞE YARAMIYOR. Backend
// CommonJS (require/module.exports); Vitest'in vi.mock'u yalnızca kendi ESM
// modül grafiğinden yüklenen bağımlılıkları yakalayabiliyor, ama chat.js gibi
// düz bir .js CommonJS dosyası Node'un NATIVE require() cache'i üzerinden
// yükleniyor ve iç require() çağrıları vitest'in grafiğinden geçmiyor (bkz.
// character.test.js'teki "store singleton dual-instance" notuyla aynı kök
// neden). Çözüm: chat.js'i require etmeden ÖNCE Node'un require.cache'ine
// aiGm.js ve rateLimiter.js için sahte modül girdileri elle enjekte etmek —
// chat.js kendi require("../services/aiGm") çağrısını yaptığında Node bu
// path için cache'te zaten bir kayıt bulup gerçek dosyayı hiç çalıştırmadan
// bizim sahte exports objemizi döndürüyor. (Bu teknik doğrudan test edilip
// doğrulandı.)
const require = createRequire(import.meta.url);

const aiGmPath = require.resolve("../services/aiGm.js");
const rateLimiterPath = require.resolve("../services/rateLimiter.js");
const chatRouterPath = require.resolve("../routes/chat.js");

const fakeAiGm = {
  isConfigured: vi.fn(),
  generateAiNarration: vi.fn(),
  MODEL_NAME: "fake-model",
};
const fakeRateLimiter = {
  allowRequest: vi.fn(),
  getStatus: vi.fn(),
  _resetForTests: vi.fn(),
};

require.cache[aiGmPath] = { id: aiGmPath, filename: aiGmPath, loaded: true, exports: fakeAiGm };
require.cache[rateLimiterPath] = {
  id: rateLimiterPath,
  filename: rateLimiterPath,
  loaded: true,
  exports: fakeRateLimiter,
};
// chat.js'in kendisi önceki bir testte (ör. chat.test.js) gerçek aiGm/rateLimiter
// ile zaten cache'lenmiş olabilir — o eski kapanışı atıp sahtelerle yeniden yüklüyoruz.
delete require.cache[chatRouterPath];
const chatRouter = require("../routes/chat.js");

const { characters, chatHistories } = require("../data/store.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRouter);
  return app;
}

beforeEach(() => {
  fakeAiGm.isConfigured.mockReset();
  fakeAiGm.generateAiNarration.mockReset();
  fakeRateLimiter.allowRequest.mockReset().mockReturnValue(true);
  characters.clear();
  chatHistories.clear();
});

describe("POST /api/chat — AI GM entegrasyonu (Gemini require.cache ile mock'lanmış)", () => {
  it("(a) yapılandırılmış + limit dahilinde + Gemini başarılı: AI cevabı kullanılır", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateAiNarration.mockResolvedValue("Gemini'den gelen atmosferik anlatım.");

    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "etrafa bak" });

    expect(res.status).toBe(201);
    expect(res.body.gmMessage.source).toBe("ai");
    expect(res.body.gmMessage.text).toBe("Gemini'den gelen atmosferik anlatım.");
    expect(fakeAiGm.generateAiNarration).toHaveBeenCalledTimes(1);
  });

  it("(b) yapılandırılmış + limit dahilinde + Gemini hata/timeout verirse: sessizce mock'a düşer", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateAiNarration.mockRejectedValue(new Error("timeout"));

    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "etrafa bak" });

    expect(res.status).toBe(201); // istek kullanıcıya hata olarak yansımıyor
    expect(res.body.gmMessage.source).toBe("mock");
    expect(typeof res.body.gmMessage.text).toBe("string");
    expect(res.body.gmMessage.text.length).toBeGreaterThan(0);
  });

  it("(c) yapılandırılmış ama rate limit aşılmışsa: Gemini hiç çağrılmadan mock'a düşer", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeRateLimiter.allowRequest.mockReturnValue(false);

    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "etrafa bak" });

    expect(res.status).toBe(201);
    expect(res.body.gmMessage.source).toBe("mock");
    expect(fakeAiGm.generateAiNarration).not.toHaveBeenCalled();
  });

  it("(d) GEMINI_API_KEY hiç yapılandırılmamışsa: Gemini hiç çağrılmadan mock'a düşer", async () => {
    fakeAiGm.isConfigured.mockReturnValue(false);

    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "etrafa bak" });

    expect(res.status).toBe(201);
    expect(res.body.gmMessage.source).toBe("mock");
    expect(fakeAiGm.generateAiNarration).not.toHaveBeenCalled();
    expect(fakeRateLimiter.allowRequest).not.toHaveBeenCalled(); // isConfigured false -> short-circuit
  });

  it("AI kaynaklı mesaj da geçmişe (history) player mesajıyla birlikte doğru sırada ekleniyor", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateAiNarration.mockResolvedValue("AI cevabı.");

    const app = buildApp();
    await request(app).post("/api/chat").send({ message: "merhaba" });
    const getRes = await request(app).get("/api/chat");

    expect(getRes.body.messages).toHaveLength(2);
    expect(getRes.body.messages[0]).toMatchObject({ role: "player", text: "merhaba" });
    expect(getRes.body.messages[1]).toMatchObject({ role: "gm", source: "ai", text: "AI cevabı." });
  });

  it("fikir #109: recentMessages, mevcut oyuncu mesajını TEKRAR içermiyor (playerMessage ayrı parametre olarak zaten geçiliyor)", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateAiNarration.mockResolvedValue("AI cevabı.");

    const app = buildApp();
    await request(app).post("/api/chat").send({ message: "ilk mesaj" });
    await request(app).post("/api/chat").send({ message: "ikinci mesaj" });

    expect(fakeAiGm.generateAiNarration).toHaveBeenCalledTimes(2);
    const secondCallArgs = fakeAiGm.generateAiNarration.mock.calls[1][0];
    expect(secondCallArgs.playerMessage).toBe("ikinci mesaj");
    expect(secondCallArgs.recentMessages.map((m) => m.text)).not.toContain("ikinci mesaj");
    expect(secondCallArgs.recentMessages.map((m) => m.text)).toContain("ilk mesaj");
  });
});
