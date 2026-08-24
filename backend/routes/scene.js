const express = require("express");
const { nanoid } = require("nanoid");
const { characters, chatHistories, activeCharacterIdBySession } = require("../data/store");
const { getScene, isBlocked, isPathBlocked } = require("../services/sceneState");
const { runEnemyTurn } = require("../services/enemyAI");
const { rollD20, rollDie } = require("../services/dice");
const { abilityModifier, DIFFICULTY_CLASS } = require("../services/actionResolver");
const { generateNarration } = require("../services/narrationService");
const { getSessionId } = require("../services/sessionId");
const { saveScene, saveChatHistory, saveCharacter } = require("../services/persistence");
const { awardXp } = require("../services/leveling");
const { SPELLS } = require("../data/spells");
const { CLASSES } = require("../data/dnd");
const { advanceToNextEncounter } = require("../data/sceneFactory");
const { trimChatHistory } = require("../services/chatHistoryLimit");
const { getWeaponDamageDie } = require("../data/weaponDamage");
const { getSlotForItem, getIconForSlot } = require("../data/itemSlots");

const router = express.Router();
// Yaratıcı cron fikir #16: /item/throw grid sınırını/menzili hiç doğrulamıyordu
// (x:99999 gibi bir değer görünmez/kayıp bir loot yaratabiliyordu). Ateş
// Topu'nun range:3'üyle tutarlı bir fırlatma menzili.
const THROW_RANGE = 3;

function getActiveCharacter(sessionId) {
  const characterId = activeCharacterIdBySession.get(sessionId);
  if (!characterId) return null;
  return characters.get(characterId) ?? null;
}

// Faz 6-B sonrası mimari not (tester): characterId body'den alınıp doğrudan
// global `characters` Map'inde aranıyordu, sessionId'nin o karakterin GERÇEK
// sahibi olduğu doğrulanmıyordu. nanoid tahmin edilemez olsa da, bir istemci
// başka bir session'ın characterId'sini bilirse onun karakterine işlem
// yaptırabilirdi. Artık her endpoint bu kontrolden geçiyor.
function requireOwnedCharacter(req, res, characterId) {
  const character = characters.get(characterId);
  if (!character) {
    res.status(404).json({ error: "Karakter bulunamadı." });
    return null;
  }
  const sessionId = getSessionId(req);
  if (activeCharacterIdBySession.get(sessionId) !== characterId) {
    res.status(403).json({ error: "Bu karaktere erişim yetkin yok." });
    return null;
  }
  if (character.hp.current <= 0) {
    res.status(400).json({ error: "Karakter ölü, oyun bitti." });
    return null;
  }
  return character;
}

// Faz 7-A: sahnedeki son düşman da düşünce sıradaki karşılaşmaya geçilir.
// Bir sonraki karşılaşmanın adını içeren bir anlatım eki döner (yoksa null).
// Yaratıcı cron fikir #14: liste sonundaki (en zor) karşılaşma temizlenip
// başa dönüldüğünde (tam bir tur tamamlandığında) özel bir tebrik cümlesi
// dönüyor - eskiden bu da diğerleriyle aynı genel mesajı alıyordu.
function checkEncounterCleared(scene) {
  const hasEnemies = scene.tokens.some((t) => t.type === "enemy");
  if (hasEnemies) return null;
  const clearedIndex = scene.encounterIndex;
  const totalEncounters = scene.totalEncounters;
  advanceToNextEncounter(scene);
  const completedFullLap = (clearedIndex + 1) % totalEncounters === 0;
  if (completedFullLap) {
    return ` Tüm bölgeyi temizledin! Kahramanlığın efsaneleşiyor... ama tehlike hiç bitmiyor, yeni bir tehdit beliriyor: ${scene.name}.`;
  }
  return ` Karşılaşma temizlendi! Yeni bir alana geçiliyor: ${scene.name}.`;
}

function getChatHistoryList(sessionId) {
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, []);
  }
  return chatHistories.get(sessionId);
}

// Faz 8: `roll` opsiyonel - ham zar detayını (attribute/roll/modifier/total/dc/outcome)
// mesaja ekler. Frontend bunu ana metinde DEĞİL, ikincil bir tooltip'te gösteriyor.
function pushGmMessage(sessionId, text, source, roll = null) {
  const history = getChatHistoryList(sessionId);
  const message = { id: nanoid(), role: "gm", text, source, timestamp: Date.now() };
  if (roll) message.roll = roll;
  history.push(message);
  trimChatHistory(history);
  saveChatHistory(sessionId, history);
}

router.get("/", (req, res) => {
  res.json(getScene(getSessionId(req)));
});

router.post("/move", async (req, res) => {
  const { tokenId, x, y } = req.body || {};
  const sessionId = getSessionId(req);
  const scene = getScene(sessionId);

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
  let updatedCharacter = null;
  if (token.type === "player") {
    const character = getActiveCharacter(sessionId);
    updatedCharacter = character;

    // Yaratıcı cron fikir #20 (coder'ın Faz 10'da bulduğu yan bug): loot
    // sahneden kaldırılıyordu ama karakterin envanterine hiç eklenmiyordu -
    // eşyalar görsel olarak yerden kayboluyor ama asla kuşanılamıyordu.
    if (collected && character) {
      const slot = getSlotForItem(collected.name);
      character.inventory.push({
        id: nanoid(),
        name: collected.name,
        equipped: false,
        slot,
        icon: getIconForSlot(slot),
      });
      saveCharacter(character);
    }

    const history = getChatHistoryList(sessionId);
    const { text, source } = await generateNarration({
      character,
      scene,
      recentMessages: history.slice(-6),
      playerMessage: `${character?.name ?? "Oyuncu"} hareket ediyor.`,
    });
    const narrationText = collected ? `${text} ${collected.name} envanterine eklendi!` : text;
    pushGmMessage(sessionId, narrationText, source);
    narration = { text: narrationText, source };
  }

  saveScene(sessionId, scene);
  res.json({ scene, collectedLoot: collected, narration, character: updatedCharacter });
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
  const sessionId = getSessionId(req);
  const scene = getScene(sessionId);
  const enemyMessages = [];

  let activeToken = advanceTurn(scene);
  // Düşman token'ların sırası tamamen deterministik/scriptli işlenir (ek AI
  // çağrısı yok), sonra sıra otomatik olarak oyuncuya geri döner.
  const character = getActiveCharacter(sessionId);
  while (activeToken.type === "enemy") {
    const message = runEnemyTurn(scene, activeToken, character);
    if (message) enemyMessages.push(message);
    activeToken = advanceTurn(scene);
  }

  for (const text of enemyMessages) {
    pushGmMessage(sessionId, text, "mock");
  }

  saveScene(sessionId, scene);
  if (character && enemyMessages.length) saveCharacter(character);

  // Geriye dönük uyumluluk: end-turn geleneksel olarak sahneyi düz (top-level)
  // döndürüyordu, mevcut testler/frontend `res.body.activeTokenId` gibi
  // doğrudan erişiyor - sahneyi olduğu gibi yayıp üstüne enemyMessages ekliyoruz.
  res.json({ ...scene, enemyMessages });
});

function requirePlayerAction(sessionId, res) {
  const scene = getScene(sessionId);
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
  const character = requireOwnedCharacter(req, res, characterId);
  if (!character) return;

  const sessionId = getSessionId(req);
  const playerToken = requirePlayerAction(sessionId, res);
  if (!playerToken) return;

  const scene = getScene(sessionId);
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

  const equippedWeapon = character.inventory.find((i) => i.slot === "hand" && i.equipped);
  const attackDamageDie = getWeaponDamageDie(equippedWeapon?.name);

  let damage = 0;
  let defeated = false;
  if (outcome === "success" || outcome === "critical-success") {
    damage = rollDie(attackDamageDie) + (outcome === "critical-success" ? rollDie(attackDamageDie) : 0);
    target.hp = Math.max(0, (target.hp ?? 0) - damage);
    if (target.hp <= 0) {
      defeated = true;
      scene.tokens = scene.tokens.filter((t) => t.id !== target.id);
    }
  }

  let levelsGained = 0;
  if (defeated) {
    levelsGained = awardXp(character, primaryAttribute);
    saveCharacter(character);
  }

  const attackResult = { attribute: primaryAttribute, roll, modifier, total, dc: DIFFICULTY_CLASS, outcome };
  const history = getChatHistoryList(sessionId);
  const { text, source } = await generateNarration({
    character,
    scene,
    recentMessages: history.slice(-6),
    playerMessage: `${character.name}, ${target.name}'e saldırıyor!`,
    actionResult: attackResult,
  });
  let narrationText = defeated ? `${text} ${target.name} yenildi!` : text;
  if (levelsGained > 0) {
    narrationText += ` ${character.name} seviye ${character.level}'e ulaştı!`;
  }
  if (defeated) {
    const encounterSuffix = checkEncounterCleared(scene);
    if (encounterSuffix) narrationText += encounterSuffix;
  }
  pushGmMessage(sessionId, narrationText, source, attackResult);
  saveScene(sessionId, scene);

  res.json({
    character,
    scene,
    attackResult,
    damage,
    defeated,
    levelsGained,
    narration: { text: narrationText, source },
  });
});

router.post("/cast", async (req, res) => {
  const { characterId, spellId, targetTokenId } = req.body || {};
  const character = requireOwnedCharacter(req, res, characterId);
  if (!character) return;

  if (!character.mana || character.mana.max <= 0) {
    return res.status(400).json({ error: "Bu sınıf büyü kullanamaz." });
  }

  const spell = SPELLS[spellId];
  if (!spell) return res.status(400).json({ error: "Geçersiz büyü." });

  if (character.mana.current < spell.manaCost) {
    return res.status(400).json({ error: "Yetersiz mana." });
  }

  const sessionId = getSessionId(req);
  const playerToken = requirePlayerAction(sessionId, res);
  if (!playerToken) return;

  const scene = getScene(sessionId);
  const history = getChatHistoryList(sessionId);

  if (spell.type === "heal") {
    character.mana.current -= spell.manaCost;
    character.hp.current = Math.min(character.hp.max, character.hp.current + spell.healAmount);
    playerToken.actionAvailable = false;

    const { text, source } = await generateNarration({
      character,
      scene,
      recentMessages: history.slice(-6),
      playerMessage: `${character.name}, ${spell.name} büyüsünü kendine uyguluyor.`,
    });
    pushGmMessage(sessionId, text, source);
    saveCharacter(character);
    saveScene(sessionId, scene);

    return res.json({
      character,
      scene,
      spell: spell.id,
      healed: spell.healAmount,
      narration: { text, source },
    });
  }

  // Menzilli saldırı büyüsü (örn. Ateş Topu) - bitişik olmak zorunda değil.
  if (!targetTokenId) return res.status(400).json({ error: "Hedef gerekli." });
  const target = scene.tokens.find((t) => t.id === targetTokenId && t.type === "enemy");
  if (!target) return res.status(404).json({ error: "Hedef bulunamadı." });

  const distance = Math.abs(target.x - playerToken.x) + Math.abs(target.y - playerToken.y);
  if (distance > spell.range) {
    return res.status(400).json({ error: "Hedef büyü menzili dışında." });
  }

  character.mana.current -= spell.manaCost;
  playerToken.actionAvailable = false;

  const primaryAttribute = CLASSES[character.class]?.primaryAttribute ?? "int";
  const modifier = abilityModifier(character.attributes[primaryAttribute]);
  const roll = rollD20();
  const total = roll + modifier;

  let outcome;
  if (roll === 20) outcome = "critical-success";
  else if (roll === 1) outcome = "critical-failure";
  else if (total >= DIFFICULTY_CLASS) outcome = "success";
  else outcome = "failure";

  let damage = 0;
  let defeated = false;
  if (outcome === "success" || outcome === "critical-success") {
    damage = rollDie(spell.damageDie) + (outcome === "critical-success" ? rollDie(spell.damageDie) : 0);
    target.hp = Math.max(0, (target.hp ?? 0) - damage);
    if (target.hp <= 0) {
      defeated = true;
      scene.tokens = scene.tokens.filter((t) => t.id !== target.id);
    }
  }

  let levelsGained = 0;
  if (defeated) {
    levelsGained = awardXp(character, primaryAttribute);
  }

  const castResult = { attribute: primaryAttribute, roll, modifier, total, dc: DIFFICULTY_CLASS, outcome };
  const { text, source } = await generateNarration({
    character,
    scene,
    recentMessages: history.slice(-6),
    playerMessage: `${character.name}, ${target.name}'e ${spell.name} büyüsü fırlatıyor!`,
    actionResult: castResult,
  });
  let narrationText = defeated ? `${text} ${target.name} yenildi!` : text;
  if (levelsGained > 0) {
    narrationText += ` ${character.name} seviye ${character.level}'e ulaştı!`;
  }
  if (defeated) {
    const encounterSuffix = checkEncounterCleared(scene);
    if (encounterSuffix) narrationText += encounterSuffix;
  }
  pushGmMessage(sessionId, narrationText, source, castResult);

  saveCharacter(character);
  saveScene(sessionId, scene);

  res.json({
    character,
    scene,
    spell: spell.id,
    castResult,
    damage,
    defeated,
    levelsGained,
    narration: { text: narrationText, source },
  });
});

router.post("/item/use", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = requireOwnedCharacter(req, res, characterId);
  if (!character) return;

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  const sessionId = getSessionId(req);
  const playerToken = requirePlayerAction(sessionId, res);
  if (!playerToken) return;

  character.inventory = character.inventory.filter((i) => i.id !== itemId);
  if (item.name.toLocaleLowerCase("tr").includes("iksir")) {
    character.hp.current = Math.min(character.hp.max, character.hp.current + 5);
  }
  playerToken.actionAvailable = false;
  saveCharacter(character);
  saveScene(sessionId, getScene(sessionId));

  res.json({ character, usedItem: item });
});

router.post("/item/equip", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = requireOwnedCharacter(req, res, characterId);
  if (!character) return;

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

  saveCharacter(character);
  res.json({ character, item });
});

router.post("/item/drop", (req, res) => {
  const { characterId, itemId } = req.body || {};
  const character = requireOwnedCharacter(req, res, characterId);
  if (!character) return;

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  character.inventory = character.inventory.filter((i) => i.id !== itemId);

  const sessionId = getSessionId(req);
  const scene = getScene(sessionId);
  const playerToken = scene.tokens.find((t) => t.id === "player");
  if (playerToken) {
    scene.loot.push({ id: nanoid(), x: playerToken.x, y: playerToken.y, name: item.name });
  }

  saveCharacter(character);
  saveScene(sessionId, scene);
  res.json({ character, droppedItem: item });
});

router.post("/item/throw", (req, res) => {
  const { characterId, itemId, x, y } = req.body || {};
  const character = requireOwnedCharacter(req, res, characterId);
  if (!character) return;

  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Eşya bulunamadı." });

  if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y)) {
    return res.status(400).json({ error: "Geçersiz koordinat." });
  }

  const sessionId = getSessionId(req);
  const scene = getScene(sessionId);

  if (x < 0 || x >= scene.width || y < 0 || y >= scene.height) {
    return res.status(400).json({ error: "Hedef harita sınırlarının dışında." });
  }

  const playerToken = requirePlayerAction(sessionId, res);
  if (!playerToken) return;

  const distance = Math.abs(x - playerToken.x) + Math.abs(y - playerToken.y);
  if (distance > THROW_RANGE) {
    return res.status(400).json({ error: "Hedef fırlatma menzili dışında." });
  }

  character.inventory = character.inventory.filter((i) => i.id !== itemId);

  scene.loot.push({ id: nanoid(), x, y, name: item.name });
  playerToken.actionAvailable = false;

  saveCharacter(character);
  saveScene(sessionId, scene);
  res.json({ character, scene, thrownItem: item });
});

module.exports = router;
