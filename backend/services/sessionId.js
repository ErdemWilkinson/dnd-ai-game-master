// Faz 6-A: oturum izolasyonu. Frontend her istekte X-Session-Id header'ı
// gönderir (crypto.randomUUID(), localStorage'da saklanıyor). Header yoksa
// (curl, eski testler) "default" tek-oturumlu eski davranışa düşer.

function getSessionId(req) {
  const header = req.headers["x-session-id"];
  if (typeof header === "string" && header.trim()) return header.trim();
  return "default";
}

module.exports = { getSessionId };
