// Basit sabit-pencereli saatlik sayaç (Faz 2 - tek oturum varsayımı).

const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = Number(process.env.AI_HOURLY_LIMIT) || 30;

let windowStart = Date.now();
let count = 0;

function resetIfWindowExpired() {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    count = 0;
  }
}

function allowRequest() {
  resetIfWindowExpired();
  if (count >= LIMIT) return false;
  count += 1;
  return true;
}

function getStatus() {
  resetIfWindowExpired();
  return { count, limit: LIMIT, windowStart, windowMs: WINDOW_MS };
}

function _resetForTests() {
  windowStart = Date.now();
  count = 0;
}

module.exports = { allowRequest, getStatus, _resetForTests };
