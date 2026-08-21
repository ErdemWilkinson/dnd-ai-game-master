const express = require("express");
const { nanoid } = require("nanoid");
const { RACES, CLASSES, BASE_ATTRIBUTES } = require("../data/dnd");
const { characters } = require("../data/store");

const router = express.Router();

// Tek oyunculu Faz 1 kapsamı: tek "aktif" karakter takip edilir.
let currentCharacterId = null;

function applyBonuses(base, bonuses) {
  const result = { ...base };
  for (const [attr, value] of Object.entries(bonuses || {})) {
    result[attr] = (result[attr] || 0) + value;
  }
  return result;
}

router.get("/options", (_req, res) => {
  res.json({
    races: Object.values(RACES),
    classes: Object.values(CLASSES),
  });
});

router.post("/create", (req, res) => {
  const { name, raceId, classId } = req.body || {};

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

  const attributes = applyBonuses(BASE_ATTRIBUTES, race.attributeBonuses);
  const id = nanoid();

  const character = {
    id,
    name: name.trim(),
    race: race.id,
    class: cls.id,
    level: 1,
    hp: { current: cls.baseHp, max: cls.baseHp },
    mana: { current: cls.baseMana, max: cls.baseMana },
    attributes,
    inventory: cls.startingInventory.map((itemName) => ({
      id: nanoid(),
      name: itemName,
      equipped: false,
    })),
  };

  characters.set(id, character);
  currentCharacterId = id;
  res.status(201).json(character);
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
