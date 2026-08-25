import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// bkz. aiGmFallback.test.js: vi.mock() bu CommonJS backend'de işe yaramıyor,
// require.cache'e karakter router'ı yüklenmeden ÖNCE sahte aiGm/rateLimiter
// modülleri enjekte ediyoruz.
const require = createRequire(import.meta.url);

const aiGmPath = require.resolve("../services/aiGm.js");
const rateLimiterPath = require.resolve("../services/rateLimiter.js");
const characterRouterPath = require.resolve("../routes/character.js");

const fakeAiGm = {
  isConfigured: vi.fn(),
  generateAiNarration: vi.fn(),
  generateOpeningStory: vi.fn(),
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
delete require.cache[characterRouterPath];
const characterRouter = require("../routes/character.js");

const { characters, chatHistories } = require("../data/store.js");
// Yaratıcı cron fikir #62: sabit "default" yerine sessionId.js'in dışa
// aktardığı gerçek fallback ID.
const { DEFAULT_SESSION_ID } = require("../services/sessionId.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/character", characterRouter);
  return app;
}

async function createTestCharacter(app) {
  const res = await request(app)
    .post("/api/character/create")
    .send({ name: "IntroTest", raceId: "human", classId: "fighter" });
  return res.body;
}

beforeEach(() => {
  fakeAiGm.isConfigured.mockReset();
  fakeAiGm.generateOpeningStory.mockReset();
  fakeRateLimiter.allowRequest.mockReset().mockReturnValue(true);
  characters.clear();
  chatHistories.clear();
});

describe("POST /api/character/intro", () => {
  it("var olmayan karakter için 404 döner", async () => {
    fakeAiGm.isConfigured.mockReturnValue(false);
    const app = buildApp();
    const res = await request(app).post("/api/character/intro").send({ characterId: "nope" });
    expect(res.status).toBe(404);
  });

  it("yapılandırılmış + Gemini başarılıysa AI açılış hikayesini döner", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateOpeningStory.mockResolvedValue("Gözlerini karanlık bir mahzende açıyorsun.");

    const app = buildApp();
    const character = await createTestCharacter(app);
    const res = await request(app).post("/api/character/intro").send({ characterId: character.id });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("ai");
    expect(res.body.text).toBe("Gözlerini karanlık bir mahzende açıyorsun.");
    expect(fakeAiGm.generateOpeningStory).toHaveBeenCalledTimes(1);
  });

  it("Gemini hata verirse sessizce mock açılış şablonuna düşer", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateOpeningStory.mockRejectedValue(new Error("timeout"));

    const app = buildApp();
    const character = await createTestCharacter(app);
    const res = await request(app).post("/api/character/intro").send({ characterId: character.id });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
    expect(typeof res.body.text).toBe("string");
    expect(res.body.text.length).toBeGreaterThan(0);
  });

  it("GEMINI_API_KEY yapılandırılmamışsa Gemini hiç çağrılmadan mock'a düşer", async () => {
    fakeAiGm.isConfigured.mockReturnValue(false);

    const app = buildApp();
    const character = await createTestCharacter(app);
    const res = await request(app).post("/api/character/intro").send({ characterId: character.id });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
    expect(fakeAiGm.generateOpeningStory).not.toHaveBeenCalled();
  });

  it("üretilen açılış mesajı sohbet geçmişine ilk GM mesajı olarak eklenir", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateOpeningStory.mockResolvedValue("Açılış metni.");

    const app = buildApp();
    const character = await createTestCharacter(app);
    await request(app).post("/api/character/intro").send({ characterId: character.id });

    const history = chatHistories.get(DEFAULT_SESSION_ID);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ role: "gm", source: "ai", text: "Açılış metni." });
  });
});
