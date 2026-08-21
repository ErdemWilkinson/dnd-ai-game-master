import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "module";

// Bu modülün başka bir singleton state'e bağımlılığı yok (store.js'e dokunmuyor),
// bu yüzden diğer backend testleriyle aynı createRequire deseni burada da
// tutarlılık için kullanılıyor.
const require = createRequire(import.meta.url);
const RATE_LIMITER_PATH = require.resolve("../services/rateLimiter.js");

// `vi.resetModules()` yalnızca vitest'in kendi modül grafiğini sıfırlar,
// native `require.cache`'i etkilemez (bu dosya createRequire kullanıyor —
// bkz. character.test.js'teki CJS/ESM tekilleştirme notu). LIMIT sabiti
// rateLimiter.js'de modül yüklenirken bir kez hesaplandığı için
// AI_HOURLY_LIMIT'i test başına değiştirebilmek adına cache'i elle temizliyoruz.
function freshRateLimiter() {
  delete require.cache[RATE_LIMITER_PATH];
  return require("../services/rateLimiter.js");
}

describe("rateLimiter — saatlik sabit pencere sayacı", () => {
  let rateLimiter;

  beforeEach(() => {
    delete process.env.AI_HOURLY_LIMIT;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("limit dahilindeki istekleri kabul eder ve sayaç artar", () => {
    process.env.AI_HOURLY_LIMIT = "5";
    rateLimiter = freshRateLimiter();
    rateLimiter._resetForTests();

    expect(rateLimiter.allowRequest()).toBe(true);
    expect(rateLimiter.allowRequest()).toBe(true);
    expect(rateLimiter.getStatus().count).toBe(2);
    expect(rateLimiter.getStatus().limit).toBe(5);
  });

  it("limit aşılınca istekleri reddeder (sayaç limiti geçmez)", () => {
    process.env.AI_HOURLY_LIMIT = "3";
    rateLimiter = freshRateLimiter();
    rateLimiter._resetForTests();

    expect(rateLimiter.allowRequest()).toBe(true);
    expect(rateLimiter.allowRequest()).toBe(true);
    expect(rateLimiter.allowRequest()).toBe(true);
    expect(rateLimiter.allowRequest()).toBe(false);
    expect(rateLimiter.allowRequest()).toBe(false);
    expect(rateLimiter.getStatus().count).toBe(3);
  });

  it("AI_HOURLY_LIMIT tanımlı değilse varsayılan 30 kullanılır", () => {
    rateLimiter = freshRateLimiter();
    rateLimiter._resetForTests();
    expect(rateLimiter.getStatus().limit).toBe(30);
  });

  it("pencere süresi dolunca sayaç sıfırlanır ve reddedilen istek tekrar kabul edilir", () => {
    vi.useFakeTimers();
    process.env.AI_HOURLY_LIMIT = "1";
    rateLimiter = freshRateLimiter();
    rateLimiter._resetForTests();

    expect(rateLimiter.allowRequest()).toBe(true);
    expect(rateLimiter.allowRequest()).toBe(false); // limit doldu

    vi.advanceTimersByTime(60 * 60 * 1000 + 1); // 1 saat + 1ms ileri sar

    expect(rateLimiter.allowRequest()).toBe(true); // pencere yenilendi
    expect(rateLimiter.getStatus().count).toBe(1);
  });

  it("pencere dolmadan sayaç sıfırlanmaz", () => {
    vi.useFakeTimers();
    process.env.AI_HOURLY_LIMIT = "1";
    rateLimiter = freshRateLimiter();
    rateLimiter._resetForTests();

    expect(rateLimiter.allowRequest()).toBe(true);
    vi.advanceTimersByTime(60 * 60 * 1000 - 1000); // 1 saatten 1sn az ileri sar
    expect(rateLimiter.allowRequest()).toBe(false);
  });
});
