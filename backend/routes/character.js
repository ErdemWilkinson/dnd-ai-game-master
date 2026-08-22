const express = require("express");
const { nanoid } = require("nanoid");
const { RACES, CLASSES, BASE_ATTRIBUTES, ATTRIBUTE_KEYS } = require("../data/dnd");
const { APPEARANCES } = require("../data/appearances");
const { getSlotForItem, getIconForSlot } = require("../data/itemSlots");
const { characters, chatHistories } = require("../data/store");
const { rollAttributes } = require("../services/dice");
const { generateOpeningStory, isConfigured } = require("../services/aiGm");
const { generateOpeningMock } = require("../data/openingFlavor");
const { allowRequest } = require("../services/rateLimiter");

const router = express.Router();

const CHAT_SESSION_KEY = "default";

// Tek oyunculu Faz 1 kapsamı: tek "aktif" karakter takip edilir.
let currentCharacterId = null;

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

  characters.set(id, character);
  currentCharacterId = id;
  res.status(201).json(character);
});

router.post("/intro", async (req, res) => {
  const { characterId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) {
    return res.status(404).json({ error: "Karakter bulunamadı." });
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

  if (!chatHistories.has(CHAT_SESSION_KEY)) {
    chatHistories.set(CHAT_SESSION_KEY, []);
  }
  const history = chatHistories.get(CHAT_SESSION_KEY);
  const introMessage = { id: nanoid(), role: "gm", text, source, timestamp: Date.now() };
  history.push(introMessage);

  res.json({ text, source });
});

router.get("/", (_req, res) => {
  if (!currentCharacterId || !characters.has(currentCharacterId)) {
    return res.status(404).json({ error: "Aktif karakter yok." });
  }
  res.json(characters.get(currentCharacterId));
});

router.post("/", (req, res) => {
  if (!currentCharacterId || !characters.has(currentCharacterId)) {
    return res.status(404).json({ error: "Aktif karakter yok." });
  }
  const character = characters.get(currentCharacterId);
  const { hp, mana, attributes, inventory } = req.body || {};
  if (hp) character.hp = { ...character.hp, ...hp };
  if (mana) character.mana = { ...character.mana, ...mana };
  if (attributes) character.attributes = { ...character.attributes, ...attributes };
  if (inventory) character.inventory = inventory;

  characters.set(character.id, character);
  res.json(character);
});

router.get("/:id", (req, res) => {
  const character = characters.get(req.params.id);
  if (!character) {
    return res.status(404).json({ error: "Karakter bulunamadı." });
  }
  res.json(character);
});

module.exports = router;
