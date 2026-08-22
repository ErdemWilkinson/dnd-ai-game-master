const express = require("express");
const { nanoid } = require("nanoid");
const { RACES, CLASSES, BASE_ATTRIBUTES, ATTRIBUTE_KEYS } = require("../data/dnd");
const { APPEARANCES } = require("../data/appearances");
const { getSlotForItem, getIconForSlot } = require("../data/itemSlots");
const { characters, chatHistories, scenes, activeCharacterIdBySession } = require("../data/store");
const { rollAttributes } = require("../services/dice");
const { generateOpeningStory, isConfigured } = require("../services/aiGm");
const { generateOpeningMock } = require("../data/openingFlavor");
const { allowRequest } = require("../services/rateLimiter");
const { getSessionId } = require("../services/sessionId");
const { saveCharacter, saveChatHistory, saveActiveCharacterId, clearSession } = require("../services/persistence");

const router = express.Router();

function applyBonuses(base, bonuses) {
  const result = { ...base };
  for (const [attr, value] of Object.entries(bonuses || {})) {
    result[attr] = (result[attr] || 0) + value;
  }
  return result;
}

function isValidAttributeSet(attributes) {
  if (!attributes || typeof attributes !== "object") return false;
  return ATTRIBUTE_KEYS.every((key) => Number.isFinite(attributes[key]));
}

router.get("/options", (_req, res) => {
  res.json({
    races: Object.values(RACES),
    classes: Object.values(CLASSES),
    appearances: Object.values(APPEARANCES),
  });
});

router.post("/roll-stats", (req, res) => {
  const { raceId } = req.body || {};
  const race = RACES[raceId];
  if (!race) {
    return res.status(400).json({ error: `Geçersiz ırk: ${raceId}` });
  }

  const rolls = rollAttributes();
  const attributes = applyBonuses(rolls, race.attributeBonuses);
  res.json({ rolls, attributes });
});

router.post("/create", (req, res) => {
  const { name, raceId, classId, appearanceId, attributes: providedAttributes } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "İsim gerekli." });
  }
  const race = RACES[raceId];
  const cls = CLASSES[classId];
  if (!race) {
    return res.status(400).json({ error: `Geçersiz ırk: ${raceId}` });
  }
  if (!cls) {
    return res.status(400).json({ error: `Geçersiz sınıf: ${classId}` });
  }
  const appearance = appearanceId ? APPEARANCES[appearanceId] : null;
  if (appearanceId && !appearance) {
    return res.status(400).json({ error: `Geçersiz dış görünüş: ${appearanceId}` });
  }

  // Zar atma istemciden gelmediyse (örn. doğrudan API testi) sunucu kendi zarını atar.
  const attributes = isValidAttributeSet(providedAttributes)
    ? providedAttributes
    : applyBonuses(rollAttributes(), race.attributeBonuses);

  const id = nanoid();

  const character = {
    id,
    name: name.trim(),
    race: race.id,
    class: cls.id,
    appearance: appearance?.id ?? null,
    level: 1,
    xp: 0,
    hp: { current: cls.baseHp, max: cls.baseHp },
    mana: { current: cls.baseMana, max: cls.baseMana },
    attributes,
    inventory: cls.startingInventory.map((itemName) => {
      const slot = getSlotForItem(itemName);
      return {
        id: nanoid(),
        name: itemName,
        equipped: false,
        slot,
        icon: getIconForSlot(slot),
      };
    }),
  };

  const sessionId = getSessionId(req);
  characters.set(id, character);
  activeCharacterIdBySession.set(sessionId, id);
  saveCharacter(character);
  saveActiveCharacterId(sessionId, id);
  res.status(201).json(character);
});

router.post("/intro", async (req, res) => {
  const { characterId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) {
    return res.status(404).json({ error: "Karakter bulunamadı." });
  }
  if (activeCharacterIdBySession.get(getSessionId(req)) !== characterId) {
    return res.status(403).json({ error: "Bu karaktere erişim yetkin yok." });
  }

  const appearanceDescription = character.appearance
    ? APPEARANCES[character.appearance]?.description
    : null;

  let text;
  let source;
  if (isConfigured() && allowRequest()) {
    try {
      text = await generateOpeningStory({ character, appearanceDescription });
      source = "ai";
    } catch (err) {
      console.error("AI açılış hikayesi başarısız, mock'a düşülüyor:", err.message);
    }
  }
  if (!text) {
    text = generateOpeningMock(character);
    source = "mock";
  }

  const sessionId = getSessionId(req);
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, []);
  }
  const history = chatHistories.get(sessionId);
  const introMessage = { id: nanoid(), role: "gm", text, source, timestamp: Date.now() };
  history.push(introMessage);
  saveChatHistory(sessionId, history);

  res.json({ text, source });
});

router.get("/", (req, res) => {
  const characterId = activeCharacterIdBySession.get(getSessionId(req));
  if (!characterId || !characters.has(characterId)) {
    return res.status(404).json({ error: "Aktif karakter yok." });
  }
  res.json(characters.get(characterId));
});

router.post("/", (req, res) => {
  const characterId = activeCharacterIdBySession.get(getSessionId(req));
  if (!characterId || !characters.has(characterId)) {
    return res.status(404).json({ error: "Aktif karakter yok." });
  }
  const character = characters.get(characterId);
  const { hp, mana, attributes, inventory } = req.body || {};
  if (hp) character.hp = { ...character.hp, ...hp };
  if (mana) character.mana = { ...character.mana, ...mana };
  if (attributes) character.attributes = { ...character.attributes, ...attributes };
  if (inventory) character.inventory = inventory;

  characters.set(character.id, character);
  saveCharacter(character);
  res.json(character);
});

// Faz 6-C: oyuncu öldükten sonra "yeniden başla" - session'ın karakter/sahne/
// sohbet bağını temizler, frontend karakter oluşturma ekranına döner.
router.post("/reset", (req, res) => {
  const sessionId = getSessionId(req);
  activeCharacterIdBySession.delete(sessionId);
  chatHistories.delete(sessionId);
  scenes.delete(sessionId);
  clearSession(sessionId);
  res.json({ ok: true });
});

router.get("/:id", (req, res) => {
  const character = characters.get(req.params.id);
  if (!character) {
    return res.status(404).json({ error: "Karakter bulunamadı." });
  }
  res.json(character);
});

module.exports = router;
