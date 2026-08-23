// Faz 9 (yaratıcı cron fikir #2): kimliksiz-erişilebilir uçlar (karakter
// oluşturma, zar atma) hiç sınırlı değildi - IP başına basit bir istek
// sınırı ekleniyor. Test koşumlarında (VITEST) devre dışı - aksi halde
// aynı test dosyasındaki onlarca ardışık istek birbirini 429'a düşürür.
const rateLimit = require("express-rate-limit");

const PUBLIC_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PUBLIC_RATE_LIMIT_MAX = Number(process.env.PUBLIC_RATE_LIMIT_MAX) || 20;

const publicRateLimit = process.env.VITEST
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: PUBLIC_RATE_LIMIT_WINDOW_MS,
      max: PUBLIC_RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Çok fazla istek gönderildi, lütfen biraz bekleyip tekrar dene." },
    });

module.exports = { publicRateLimit };
