const express = require("express");
const { nanoid } = require("nanoid");
const { characters } = require("../data/store");
const { getScene } = require("../services/sceneState");

const router = express.Router();

function isBlocked(scene, x, y) {
  if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return true;
  if (scene.obstacles.some((o) => o.x === x && o.y === y)) return true;
  if (scene.tokens.some((t) => t.x === x && t.y === y)) return true;
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

router.get("/", (_req, res) => {
  res.json(getScene());
});

router.post("/move", (req, res) => {
  const { tokenId, x, y } = req.body || {};
  const scene = getScene();

  const token = scene.tokens.find((t) => t.id === tokenId);
  if (!token) {
    return res.status(404).json({ error: "Token bulunamadı." });
  }
  if (scene.activeTokenId !== tokenId) {
    return res.status(400).json({ error: "Sıra bu token'da değil." });
  }
  if (typeof x !== "number" || typeof y !== "number") {
    return res.status(400).json({ error: "Geçersiz koordinat." });
  }
  const distance = Math.abs(x - token.x) + Math.abs(y - token.y);
  if (distance > token.movementLeft) {
    return res.status(400).json({ error: "Hedef menzil dışında." });
  }
  if (isBlocked(scene, x, y)) {
    return res.status(400).json({ error: "Hedef kare engelli." });
  }
  if (isPathBlocked(scene, token.x, token.y, x, y)) {
    return res.status(400).json({ error: "Yol bir engelle kesiliyor." });
  }

  token.x = x;
  token.y = y;
  token.movementLeft -= distance;

  const lootIndex = scene.loot.findIndex((l) => l.x === x && l.y === y);
  let collected = null;
  if (lootIndex !== -1) {
    collected = scene.loot.splice(lootIndex, 1)[0];
  }

  res.json({ scene, collectedLoot: collected });
});

router.post("/end-turn", (req, res) => {
  const scene = getScene();
  const order = scene.tokens.map((t) => t.id);
  const currentIndex = order.indexOf(scene.activeTokenId);
  const nextIndex = (currentIndex + 1) % order.length;
  scene.activeTokenId = order[nextIndex];
  if (nextIndex === 0) {
    scene.round += 1;
  }

  const nextToken = scene.tokens[nextIndex];
  nextToken.actionAvailable = true;
  nextToken.bonusActionAvailable = true;
  nextToken.movementLeft = nextToken.speed;

  res.json(scene);
});

function requirePlayerAction(res) {
  const scene = getScene();
  const playerToken = scene.tokens.find((t) => t.id === "player");
  if (scene.activeTokenId !== "player") {
    res.status(400).json({ error: "Sıra sende değil." });
    return null;
  }
  if (!playerToken?.actionAvailable) {
    res.status(400).json({ error: "Bu tur için Aksiyon hakkın kalmadı." });
    return null;
  }
  return playerToken;
}

router.post("/item/use", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) return res.status(404).json({ error: "Karakter bulunamadı." });

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  const playerToken = requirePlayerAction(res);
  if (!playerToken) return;

  character.inventory = character.inventory.filter((i) => i.id !== itemId);
  if (item.name.toLocaleLowerCase("tr").includes("iksir")) {
    character.hp.current = Math.min(character.hp.max, character.hp.current + 5);
  }
  playerToken.actionAvailable = false;

  res.json({ character, usedItem: item });
});

router.post("/item/equip", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) return res.status(404).json({ error: "Karakter bulunamadı." });

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  if (!item.slot) {
    return res.status(400).json({ error: "Bu eşya kuşanılamaz." });
  }

  if (item.equipped) {
    item.equipped = false;
  } else {
    // Aynı slotta zaten kuşanılmış başka bir eşya varsa önce onu çıkar (paper-doll).
    for (const other of character.inventory) {
      if (other.id !== item.id && other.slot === item.slot && other.equipped) {
        other.equipped = false;
      }
    }
    item.equipped = true;
  }

  res.json({ character, item });
});

router.post("/item/drop", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) return res.status(404).json({ error: "Karakter bulunamadı." });

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  character.inventory = character.inventory.filter((i) => i.id !== itemId);

  const scene = getScene();
  const playerToken = scene.tokens.find((t) => t.id === "player");
  if (playerToken) {
    scene.loot.push({ id: nanoid(), x: playerToken.x, y: playerToken.y, name: item.name });
  }

  res.json({ character, droppedItem: item });
});

router.post("/item/throw", (req, res) => {
  const { characterId, itemId, x, y } = req.body || {};
  const character = characters.get(characterId);
  if (!character) return res.status(404).json({ error: "Karakter bulunamadı." });

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  if (typeof x !== "number" || typeof y !== "number") {
    return res.status(400).json({ error: "Geçersiz koordinat." });
  }

  const playerToken = requirePlayerAction(res);
  if (!playerToken) return;

  character.inventory = character.inventory.filter((i) => i.id !== itemId);

  const scene = getScene();
  scene.loot.push({ id: nanoid(), x, y, name: item.name });
  playerToken.actionAvailable = false;

  res.json({ character, scene, thrownItem: item });
});

module.exports = router;
