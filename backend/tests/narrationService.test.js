import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";

// bkz. aiGmFallback.test.js: vi.mock() bu CommonJS backend'de işe yaramıyor,
// require.cache'e narrationService yüklenmeden ÖNCE sahte aiGm/rateLimiter
// modülleri enjekte ediyoruz.
const require = createRequire(import.meta.url);

const aiGmPath = require.resolve("../services/aiGm.js");
const rateLimiterPath = require.resolve("../services/rateLimiter.js");
const narrationServicePath = require.resolve("../services/narrationService.js");

const fakeAiGm = { isConfigured: vi.fn(), generateAiNarration: vi.fn() };
const fakeRateLimiter = { allowRequest: vi.fn() };

require.cache[aiGmPath] = { id: aiGmPath, filename: aiGmPath, loaded: true, exports: fakeAiGm };
require.cache[rateLimiterPath] = {
  id: rateLimiterPath,
  filename: rateLimiterPath,
  loaded: true,
  exports: fakeRateLimiter,
};
delete require.cache[narrationServicePath];
const { generateNarration } = require("../services/narrationService.js");

beforeEach(() => {
  fakeAiGm.isConfigured.mockReset();
  fakeAiGm.generateAiNarration.mockReset();
  fakeRateLimiter.allowRequest.mockReset().mockReturnValue(true);
});

describe("generateNarration", () => {
  it("yapılandırılmış + limit dahilinde + Gemini başarılıysa source:'ai' döner", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateAiNarration.mockResolvedValue("AI anlatımı.");

    const result = await generateNarration({ playerMessage: "test" });

    expect(result).toEqual({ text: "AI anlatımı.", source: "ai" });
  });

  it("Gemini hata verirse sessizce mock'a düşer", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeAiGm.generateAiNarration.mockRejectedValue(new Error("timeout"));

    const result = await generateNarration({ playerMessage: "test" });

    expect(result.source).toBe("mock");
    expect(typeof result.text).toBe("string");
  });

  it("key yoksa Gemini'ye hiç çağrı yapılmadan mock döner", async () => {
    fakeAiGm.isConfigured.mockReturnValue(false);

    const result = await generateNarration({ playerMessage: "test" });

    expect(result.source).toBe("mock");
    expect(fakeAiGm.generateAiNarration).not.toHaveBeenCalled();
  });

  it("actionResult verilmişse mock metnine outcome'a göre ek cümle eklenir", async () => {
    fakeAiGm.isConfigured.mockReturnValue(false);

    const successResult = await generateNarration({
      playerMessage: "test",
      actionResult: { outcome: "critical-failure" },
    });
    expect(successResult.text).toMatch(/en kötü şekilde ters gitti/);

    const failResult = await generateNarration({
      playerMessage: "test",
      actionResult: { outcome: "success" },
    });
    expect(failResult.text).not.toMatch(/en kötü şekilde ters gitti/);
  });

  it("actionResult verilmemişse (örn. hareket anlatımı) hata vermeden çalışır", async () => {
    fakeAiGm.isConfigured.mockReturnValue(false);

    const result = await generateNarration({ playerMessage: "Karakter hareket ediyor." });

    expect(typeof result.text).toBe("string");
    expect(result.source).toBe("mock");
  });

  it("rate limit aşılmışsa Gemini hiç çağrılmadan mock'a düşer", async () => {
    fakeAiGm.isConfigured.mockReturnValue(true);
    fakeRateLimiter.allowRequest.mockReturnValue(false);

    const result = await generateNarration({ playerMessage: "test" });

    expect(result.source).toBe("mock");
    expect(fakeAiGm.generateAiNarration).not.toHaveBeenCalled();
  });
});
