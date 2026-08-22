const express = require("express");
const { nanoid } = require("nanoid");
const { characters, chatHistories } = require("../data/store");
const { getScene, isBlocked, isPathBlocked } = require("../services/sceneState");
const { runEnemyTurn } = require("../services/enemyAI");
const { rollD20, rollDie } = require("../services/dice");
const { abilityModifier, DIFFICULTY_CLASS } = require("../services/actionResolver");
const { generateNarration } = require("../services/narrationService");
const { CLASSES } = require("../data/dnd");

const router = express.Router();
const CHAT_SESSION_KEY = "default";
const ATTACK_DAMAGE_DIE = 6;

function getActiveCharacter() {
  const all = Array.from(characters.values());
  return all[all.length - 1] ?? null;
}

function getChatHistoryList() {
  if (!chatHistories.has(CHAT_SESSION_KEY)) {
    chatHistories.set(CHAT_SESSION_KEY, []);
  }
  return chatHistories.get(CHAT_SESSION_KEY);
}

function pushGmMessage(text, source) {
  getChatHistoryList().push({ id: nanoid(), role: "gm", text, source, timestamp: Date.now() });
}

router.get("/", (_req, res) => {
  res.json(getScene());
});

router.post("/move", async (req, res) => {
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

  let narration = null;
  if (token.type === "player") {
    const character = getActiveCharacter();
    const history = getChatHistoryList();
    const { text, source } = await generateNarration({
      character,
      scene,
      recentMessages: history.slice(-6),
      playerMessage: `${character?.name ?? "Oyuncu"} hareket ediyor.`,
    });
    pushGmMessage(text, source);
    narration = { text, source };
  }

  res.json({ scene, collectedLoot: collected, narration });
});

function advanceTurn(scene) {
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
  return nextToken;
}

router.post("/end-turn", (req, res) => {
  const scene = getScene();
  const enemyMessages = [];

  let activeToken = advanceTurn(scene);
  // Düşman token'ların sırası tamamen deterministik/scriptli işlenir (ek AI
  // çağrısı yok), sonra sıra otomatik olarak oyuncuya geri döner.
  while (activeToken.type === "enemy") {
    const character = getActiveCharacter();
    const message = runEnemyTurn(scene, activeToken, character);
    if (message) enemyMessages.push(message);
    activeToken = advanceTurn(scene);
  }

  for (const text of enemyMessages) {
    pushGmMessage(text, "mock");
  }

  // Geriye dönük uyumluluk: end-turn geleneksel olarak sahneyi düz (top-level)
  // döndürüyordu, mevcut testler/frontend `res.body.activeTokenId` gibi
  // doğrudan erişiyor - sahneyi olduğu gibi yayıp üstüne enemyMessages ekliyoruz.
  res.json({ ...scene, enemyMessages });
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

router.post("/attack", async (req, res) => {
  const { characterId, targetTokenId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) return res.status(404).json({ error: "Karakter bulunamadı." });

  const playerToken = requirePlayerAction(res);
  if (!playerToken) return;

  const scene = getScene();
  const target = scene.tokens.find((t) => t.id === targetTokenId && t.type === "enemy");
  if (!target) return res.status(404).json({ error: "Hedef bulunamadı." });

  const distance = Math.abs(target.x - playerToken.x) + Math.abs(target.y - playerToken.y);
  if (distance !== 1) {
    return res.status(400).json({ error: "Hedef menzil dışında (bitişik olmalı)." });
  }

  const primaryAttribute = CLASSES[character.class]?.primaryAttribute ?? "str";
  const modifier = abilityModifier(character.attributes[primaryAttribute]);
  const roll = rollD20();
  const total = roll + modifier;

  let outcome;
  if (roll === 20) outcome = "critical-success";
  else if (roll === 1) outcome = "critical-failure";
  else if (total >= DIFFICULTY_CLASS) outcome = "success";
  else outcome = "failure";

  playerToken.actionAvailable = false;

  let damage = 0;
  let defeated = false;
  if (outcome === "success" || outcome === "critical-success") {
    damage = rollDie(ATTACK_DAMAGE_DIE) + (outcome === "critical-success" ? rollDie(ATTACK_DAMAGE_DIE) : 0);
    target.hp = Math.max(0, (target.hp ?? 0) - damage);
    if (target.hp <= 0) {
      defeated = true;
      scene.tokens = scene.tokens.filter((t) => t.id !== target.id);
    }
  }

  const attackResult = { attribute: primaryAttribute, roll, modifier, total, dc: DIFFICULTY_CLASS, outcome };
  const history = getChatHistoryList();
  const { text, source } = await generateNarration({
    character,
    scene,
    recentMessages: history.slice(-6),
    playerMessage: `${character.name}, ${target.name}'e saldırıyor!`,
    actionResult: attackResult,
  });
  const narrationText = defeated ? `${text} ${target.name} yenildi!` : text;
  pushGmMessage(narrationText, source);

  res.json({
    character,
    scene,
    attackResult,
    damage,
    defeated,
    narration: { text: narrationText, source },
  });
});

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
