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
const { publicRateLimit } = require("../services/publicRateLimit");

const router = express.Router();
// Yaratıcı cron fikir #40: fikir #36 sadece /chat'i publicRateLimit'e
// bağlamıştı - move/end-turn/attack/cast/item/use gibi bu router'daki
// route'ların çoğu da generateNarration() üzerinden AYNI paylaşılan saatlik
// AI bütçesini (services/rateLimiter.js) tüketiyor, üstelik tıklama yazmaktan
// daha hızlı olduğundan bütçeyi chat'ten bile daha çabuk boşaltabilir.
// Router seviyesinde tek middleware - tek tek route'lara eklemeye gerek yok.
router.use(publicRateLimit);
// Yaratıcı cron fikir #16: /item/throw grid sınırını/menzili hiç doğrulamıyordu
// (x:99999 gibi bir değer görünmez/kayıp bir loot yaratabiliyordu). Ateş
// Topu'nun range:3'üyle tutarlı bir fırlatma menzili.
const THROW_RANGE = 3;
// Yaratıcı cron fikir #21: loot toplama düzeltilince (#20) sonsuz döngüdeki
// karşılaşmalar aynı loot'u her turda yeniden sunmaya devam ediyor - üst
// sınır olmadan envanter teorik olarak sınırsız büyüyebilirdi.
const MAX_INVENTORY = 30;
// Yaratıcı cron fikir #43 (kullanıcı kararı: AoE): Ateş Topu artık hedefe
// bitişik (Manhattan mesafesi ≤1) TÜM düşmanlara da hasar veriyor - sadece
// tek hedefe menzilli bir kılıç darbesi olmaktan çıkıp gerçek bir "alan"
// büyüsü hissi veriyor. Oyuncu bu yarıçapa dahil edilmiyor (PvE, dost ateşi
// yok) çünkü zaten oyuncu bir düşman token'ı değil.
const FIREBALL_AOE_RADIUS = 1;

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
// Faz 11 (PM kararı): eskiden bu geçiş ANINDA (aynı /attack-/cast cevabında)
// gerçekleşiyordu - yeni karşılaşmanın düşmanları hiç ara vermeden sahneye
// giriyordu, bu da "savaş sadece düşman varken görünür" UI'ının pratikte hiç
// düşmansız bir an yaşamamasına yol açıyordu (sonsuz zindan tasarımı). Artık
// temizlenince sahne SADECE oyuncuyla kalıyor (`pendingEncounterIndex`
// işaretleniyor, `advanceToNextEncounter` HENÜZ çağrılmıyor) - oyuncu bir-iki
// hamlelik düşmansız/metin-modu bir an yaşıyor, asıl geçiş oyuncunun
// SIRADAKİ `/move` çağrısında (aşağıdaki `resolvePendingEncounter`)
// "yürüyerek yeni alana giriyor" hissiyle gerçekleşiyor.
function checkEncounterCleared(scene) {
  const hasEnemies = scene.tokens.some((t) => t.type === "enemy");
  if (hasEnemies || scene.pendingEncounterIndex != null) return null;
  const clearedIndex = scene.encounterIndex;
  const totalEncounters = scene.totalEncounters;
  scene.pendingEncounterIndex = clearedIndex + 1;
  const completedFullLap = (clearedIndex + 1) % totalEncounters === 0;
  if (completedFullLap) {
    return " Tüm bölgeyi temizledin! Kahramanlığın efsaneleşiyor... ama tehlike hiç bitmiyor, biraz ilerleyince yeni bir tehdit seni bekliyor.";
  }
  return " Alanı temizledin, ilerliyorsun...";
}

// Faz 11: bekleyen bir karşılaşma geçişi varsa, oyuncunun bu hareketini asıl
// hedefe (x,y) uygulamak yerine "yeni alana giriş" olarak yorumlar - yeni
// karşılaşmayı kurar (spawn/tur/aksiyon sıfırlanır) ve buna göre bir anlatım
// döner. `true` dönerse çağıran taraf normal hareket mantığını ATLAMALI.
async function resolvePendingEncounter(sessionId, scene, character, res) {
  if (scene.pendingEncounterIndex == null) return false;

  advanceToNextEncounter(scene);
  scene.pendingEncounterIndex = null;

  const history = getChatHistoryList(sessionId);
  const { text, source } = await generateNarration({
    character,
    scene,
    recentMessages: history.slice(-6),
    playerMessage: `${character?.name ?? "Oyuncu"} yeni bir alana giriyor.`,
  });
  const narrationText = `${text} Yeni alan: ${scene.name}.`;
  pushGmMessage(sessionId, narrationText, source);

  saveScene(sessionId, scene);
  res.json({
    scene,
    collectedLoot: null,
    inventoryFull: false,
    narration: { text: narrationText, source },
    character,
  });
  return true;
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
  let activeCharacterForMove = null;
  if (token.type === "player") {
    // Tester'ın (claude-game-38) bulduğu tutarsızlık: /attack, /cast, /item
    // requireOwnedCharacter() ile karakter ölüyse (HP<=0) reddediliyordu ama
    // /move hiç kontrol etmiyordu.
    activeCharacterForMove = getActiveCharacter(sessionId);
    if (activeCharacterForMove && activeCharacterForMove.hp.current <= 0) {
      return res.status(400).json({ error: "Karakter ölü, oyun bitti." });
    }

    // Faz 11: bekleyen bir karşılaşma geçişi varsa bu hareket isteğini
    // "yeni alana giriş" olarak yorumla, normal hedef-koordinat mantığını
    // hiç çalıştırma (yeni haritada anlamsız olurdu).
    if (await resolvePendingEncounter(sessionId, scene, activeCharacterForMove, res)) {
      return;
    }
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
  let inventoryFull = false;

  let narration = null;
  let updatedCharacter = null;
  if (token.type === "player") {
    const character = activeCharacterForMove;
    updatedCharacter = character;

    // Yaratıcı cron fikir #20 (coder'ın Faz 10'da bulduğu yan bug): loot
    // sahneden kaldırılıyordu ama karakterin envanterine hiç eklenmiyordu -
    // eşyalar görsel olarak yerden kayboluyor ama asla kuşanılamıyordu.
    if (lootIndex !== -1) {
      if (character && character.inventory.length >= MAX_INVENTORY) {
        // Yaratıcı cron fikir #21: loot artık gerçekten toplandığından
        // (fikir #20) envanter üst sınırı olmadan sonsuz döngüdeki
        // karşılaşmalar sınırsız kopya biriktirebilirdi - dolu envanterde
        // eşya sahnede/yerde kalır, alınmaz.
        inventoryFull = true;
      } else {
        collected = scene.loot.splice(lootIndex, 1)[0];
        if (character) {
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
      }
    }

    const history = getChatHistoryList(sessionId);
    const { text, source } = await generateNarration({
      character,
      scene,
      recentMessages: history.slice(-6),
      playerMessage: `${character?.name ?? "Oyuncu"} hareket ediyor.`,
    });
    let narrationText = text;
    if (collected) narrationText += ` ${collected.name} envanterine eklendi!`;
    else if (inventoryFull) narrationText += ` Envanterin dolu, yerdeki eşyayı alamadın.`;
    pushGmMessage(sessionId, narrationText, source);
    narration = { text: narrationText, source };
  } else if (lootIndex !== -1) {
    collected = scene.loot.splice(lootIndex, 1)[0];
  }

  saveScene(sessionId, scene);
  res.json({ scene, collectedLoot: collected, inventoryFull, narration, character: updatedCharacter });
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

  // Tester'ın (claude-game-38) bulduğu tutarsızlık: /attack, /cast, /item
  // requireOwnedCharacter() ile karakter ölüyse (HP<=0) reddediliyordu ama
  // /move ve /end-turn hiç kontrol etmiyordu - ölü bir karakterle tur
  // bitirilip düşman turu bile işlenebiliyordu.
  const character = getActiveCharacter(sessionId);
  if (character && character.hp.current <= 0) {
    return res.status(400).json({ error: "Karakter ölü, oyun bitti." });
  }

  const enemyMessages = [];

  let activeToken = advanceTurn(scene);
  // Düşman token'ların sırası tamamen deterministik/scriptli işlenir (ek AI
  // çağrısı yok), sonra sıra otomatik olarak oyuncuya geri döner.
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

// Yaratıcı cron fikir #35: Aksiyon/Bonus Aksiyon ekonomisi (bu fonksiyon)
// sadece `/end-turn`'den sıfırlanıyor, ama "Turu Bitir" butonu SADECE
// TacticalGrid'te (sahnede düşman varken, mode-combat) render ediliyor.
// Savaş dışında (metin modu, düşman yok) bir iksir içen/eşya fırlatan/
// büyü kullanan oyuncu `actionAvailable`'ı bir daha hiç sıfırlayamayıp
// bir sonraki savaşa kadar KALICI olarak kilitleniyordu - gerçek bir
// soft-lock. Sahnede hiç düşman yoksa bu ekonomi kontrolünü tamamen
// atlıyoruz; Aksiyon ekonomisi sadece gerçek savaşta anlamlı.
function requirePlayerAction(sessionId, res) {
  const scene = getScene(sessionId);
  const playerToken = scene.tokens.find((t) => t.id === "player");
  const hasEnemies = scene.tokens.some((t) => t.type === "enemy");
  if (!hasEnemies) return playerToken;
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

  // Fikir #43 (kullanıcı kararı: AoE): isabet ederse hasar hem asıl hedefe
  // hem de ona bitişik (Manhattan mesafesi ≤ FIREBALL_AOE_RADIUS) diğer
  // düşmanlara uygulanıyor - tek bir zar/isabet kontrolü patlamanın tamamını
  // belirliyor (ıskalarsa hiçbir düşman etkilenmez), ama hasar zarı her
  // düşman için AYRI atılıyor (aynı patlamada bile şansa göre değişsin diye).
  let damage = 0;
  let defeated = false;
  const blastHits = [];
  if (outcome === "success" || outcome === "critical-success") {
    const blastTargets = scene.tokens.filter(
      (t) =>
        t.type === "enemy" &&
        (t.id === target.id || Math.abs(t.x - target.x) + Math.abs(t.y - target.y) <= FIREBALL_AOE_RADIUS),
    );
    for (const enemy of blastTargets) {
      const enemyDamage = rollDie(spell.damageDie) + (outcome === "critical-success" ? rollDie(spell.damageDie) : 0);
      enemy.hp = Math.max(0, (enemy.hp ?? 0) - enemyDamage);
      const enemyDefeated = enemy.hp <= 0;
      blastHits.push({ id: enemy.id, name: enemy.name, damage: enemyDamage, defeated: enemyDefeated });
      if (enemy.id === target.id) {
        damage = enemyDamage;
        defeated = enemyDefeated;
      }
    }
    const defeatedIds = new Set(blastHits.filter((h) => h.defeated).map((h) => h.id));
    scene.tokens = scene.tokens.filter((t) => !defeatedIds.has(t.id));
  }

  let levelsGained = 0;
  for (const hit of blastHits) {
    if (hit.defeated) levelsGained += awardXp(character, primaryAttribute);
  }

  const castResult = { attribute: primaryAttribute, roll, modifier, total, dc: DIFFICULTY_CLASS, outcome };
  const { text, source } = await generateNarration({
    character,
    scene,
    recentMessages: history.slice(-6),
    playerMessage: `${character.name}, ${target.name}'e ${spell.name} büyüsü fırlatıyor!`,
    actionResult: castResult,
  });
  const defeatedHits = blastHits.filter((h) => h.defeated);
  let narrationText = text;
  if (blastHits.length > 1) {
    narrationText += ` Patlama ${blastHits.length} düşmana çarptı, ${defeatedHits.length} tanesi yenildi!`;
  } else if (defeated) {
    narrationText += ` ${target.name} yenildi!`;
  }
  if (levelsGained > 0) {
    narrationText += ` ${character.name} seviye ${character.level}'e ulaştı!`;
  }
  if (defeatedHits.length > 0) {
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
    blastHits,
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
