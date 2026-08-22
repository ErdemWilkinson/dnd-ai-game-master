const { scenes } = require("../data/store");
const { createDefaultScene } = require("../data/sceneFactory");

function getScene(sessionId) {
  if (!scenes.has(sessionId)) {
    scenes.set(sessionId, createDefaultScene());
  }
  return scenes.get(sessionId);
}

function isBlocked(scene, x, y, ignoreTokenId) {
  if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return true;
  if (scene.obstacles.some((o) => o.x === x && o.y === y)) return true;
  if (scene.tokens.some((t) => t.id !== ignoreTokenId && t.x === x && t.y === y)) return true;
  return false;
}

// Basit bir yol kontrolü (tam pathfinding değil): kaynaktan hedefe düz bir
// çizgi (Bresenham) çizip aradaki karelerin bir engelle çakışıp çakışmadığına
// bakar. Diyagonal/L-şekilli hareketlerde tam isabetli olmayabilir ama
// "engelin üzerinden atlama" hatasını engellemek için yeterli.
function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

function isPathBlocked(scene, x0, y0, x1, y1) {
  const points = bresenhamLine(x0, y0, x1, y1);
  // İlk nokta (mevcut konum) ve son nokta (hedef, ayrıca isBlocked ile
  // kontrol ediliyor) hariç aradaki kareleri kontrol et.
  for (let i = 1; i < points.length - 1; i++) {
    const { x, y } = points[i];
    if (scene.obstacles.some((o) => o.x === x && o.y === y)) return true;
  }
  return false;
}

module.exports = { getScene, isBlocked, isPathBlocked, bresenhamLine };
