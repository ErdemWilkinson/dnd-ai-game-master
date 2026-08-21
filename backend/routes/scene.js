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
  if (distance > token.speed) {
    return res.status(400).json({ error: "Hedef menzil dışında." });
  }
  if (isBlocked(scene, x, y)) {
    return res.status(400).json({ error: "Hedef kare engelli." });
  }

  token.x = x;
  token.y = y;

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
  res.json(scene);
});

router.post("/item/use", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) return res.status(404).json({ error: "Karakter bulunamadı." });

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  character.inventory = character.inventory.filter((i) => i.id !== itemId);
  if (item.name.toLocaleLowerCase("tr").includes("iksir")) {
    character.hp.current = Math.min(character.hp.max, character.hp.current + 5);
  }

  res.json({ character, usedItem: item });
});

router.post("/item/equip", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) return res.status(404).json({ error: "Karakter bulunamadı." });

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  item.equipped = !item.equipped;
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

  character.inventory = character.inventory.filter((i) => i.id !== itemId);

  const scene = getScene();
  scene.loot.push({ id: nanoid(), x, y, name: item.name });

  res.json({ character, scene, thrownItem: item });
});

module.exports = router;
