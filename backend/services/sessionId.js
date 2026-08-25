// Faz 6-A: oturum izolasyonu. Frontend her istekte X-Session-Id header'ı
// gönderir (crypto.randomUUID(), localStorage'da saklanıyor). Header yoksa
// (curl, eski testler) tek-oturumlu eski davranışa düşer.
//
// Yaratıcı cron fikir #62: eskiden sabit "default" string'ine düşülüyordu -
// header göndermeyen HERHANGİ bir istemci (curl/bot) aynı tahmin edilebilir/
// paylaşılan "genel" session'a erişebiliyordu. Artık modül yüklenirken BİR
// KEZ üretilen tahmin edilemeyen bir UUID'ye düşülüyor - header'sız ardışık
// istekler hâlâ tutarlı aynı session'a düşer (davranış değişmedi), ama kimse
// bu ID'yi önceden tahmin edemez. Gerçek oyuncular etkilenmiyor (frontend
// her zaman kendi UUID'sini gönderiyor).
const { randomUUID } = require("crypto");

const DEFAULT_SESSION_ID = randomUUID();

function getSessionId(req) {
  const header = req.headers["x-session-id"];
  if (typeof header === "string" && header.trim()) return header.trim();
  return DEFAULT_SESSION_ID;
}

module.exports = { getSessionId, DEFAULT_SESSION_ID };
