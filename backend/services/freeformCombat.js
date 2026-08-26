// Faz 12-A (serbest-form mimari sıfırlaması): `/chat`'teki serbest metinden
// GERÇEK mekanik sonuçlar (hasar/HP, XP/level, envanter) üretir. Saldırı
// mekaniği, grid'in `routes/scene.js`'teki `/attack` route'uyla AYNI D20+
// hasar/XP mantığını kullanır (primary attribute, silah hasar zarı, kritik
// vuruş) - tek fark hedefin bitişik/menzil kontrolü olmaması (x/y yok) ve
// hedefin metinden isim eşleşmesiyle seçilmesi (yoksa ilk canlı düşman).
const { rollD20, rollDie } = require("./dice");
const { abilityModifier, DIFFICULTY_CLASS, isAttackIntent, isPickupIntent, isConsumeIntent } = require("./actionResolver");
const { CLASSES } = require("../data/dnd");
const { getWeaponDamageDie } = require("../data/weaponDamage");
const { getSlotForItem, getIconForSlot } = require("../data/itemSlots");
const { awardXp } = require("./leveling");
const { getFreeformEncounter, advanceFreeformEncounter } = require("./freeformEncounter");
const { nanoid } = require("nanoid");

// Fikir #21/#35'in grid'deki aynı üst sınırı (routes/scene.js: MAX_INVENTORY) -
// serbest-form loot toplama da aynı kurala tabi.
const MAX_INVENTORY = 30;
// scene.js'in /item/use'daki aynı iyileştirme miktarı ("iksir" adı geçen her eşya).
const POTION_HEAL_AMOUNT = 5;

function findTargetEnemy(state, text) {
  const lower = (text || "").toLocaleLowerCase("tr");
  const named = state.enemies.find((e) => lower.includes(e.name.toLocaleLowerCase("tr")));
  return named ?? state.enemies[0] ?? null;
}

function resolveAttack(character, sessionId, text) {
  const state = getFreeformEncounter(sessionId);
  if (state.enemies.length === 0) return null;

  const target = findTargetEnemy(state, text);
  if (!target) return null;

  const primaryAttribute = CLASSES[character.class]?.primaryAttribute ?? "str";
  const modifier = abilityModifier(character.attributes[primaryAttribute]);
  const roll = rollD20();
  const total = roll + modifier;

  let outcome;
  if (roll === 20) outcome = "critical-success";
  else if (roll === 1) outcome = "critical-failure";
  else if (total >= DIFFICULTY_CLASS) outcome = "success";
  else outcome = "failure";

  const equippedWeapon = character.inventory.find((i) => i.slot === "hand" && i.equipped);
  const attackDamageDie = getWeaponDamageDie(equippedWeapon?.name);

  let damage = 0;
  let defeated = false;
  if (outcome === "success" || outcome === "critical-success") {
    damage = rollDie(attackDamageDie) + (outcome === "critical-success" ? rollDie(attackDamageDie) : 0);
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp <= 0) {
      defeated = true;
      state.enemies = state.enemies.filter((e) => e.id !== target.id);
    }
  }

  let levelsGained = 0;
  if (defeated) {
    levelsGained = awardXp(character, primaryAttribute);
  }

  let encounterCleared = false;
  let nextEncounterName = null;
  let completedFullLap = false;
  if (defeated && state.enemies.length === 0) {
    encounterCleared = true;
    const next = advanceFreeformEncounter(sessionId);
    nextEncounterName = next.name;
    completedFullLap = next.completedFullLap;
  }

  return {
    kind: "attack",
    target: { id: target.id, name: target.name },
    actionResult: { attribute: primaryAttribute, roll, modifier, total, dc: DIFFICULTY_CLASS, outcome },
    damage,
    defeated,
    levelsGained,
    encounterCleared,
    nextEncounterName,
    completedFullLap,
  };
}

function resolveConsume(character) {
  const potion = character.inventory.find((i) => i.name.toLocaleLowerCase("tr").includes("iksir"));
  if (!potion) return null;

  character.inventory = character.inventory.filter((i) => i.id !== potion.id);
  const healed = Math.min(character.hp.max, character.hp.current + POTION_HEAL_AMOUNT) - character.hp.current;
  character.hp.current = Math.min(character.hp.max, character.hp.current + POTION_HEAL_AMOUNT);

  return { kind: "consume", item: { id: potion.id, name: potion.name }, healed };
}

function resolvePickup(character, sessionId) {
  const state = getFreeformEncounter(sessionId);
  if (state.loot.length === 0) return null;
  if (character.inventory.length >= MAX_INVENTORY) {
    return { kind: "pickup", inventoryFull: true };
  }

  const item = state.loot.shift();
  const slot = getSlotForItem(item.name);
  character.inventory.push({ id: nanoid(), name: item.name, equipped: false, slot, icon: getIconForSlot(slot) });

  return { kind: "pickup", item: { id: item.id, name: item.name }, inventoryFull: false };
}

// Öncelik sırası: saldırı > eşya kullan > eşya al - bir mesaj birden fazla
// kalıba uysa bile (nadir) TEK bir mekanik sonuç üretilir, anlatım karışmaz.
function resolveFreeformAction(character, sessionId, text) {
  if (!character) return null;

  if (isAttackIntent(text)) {
    const result = resolveAttack(character, sessionId, text);
    if (result) return result;
  }
  if (isConsumeIntent(text)) {
    const result = resolveConsume(character);
    if (result) return result;
  }
  if (isPickupIntent(text)) {
    const result = resolvePickup(character, sessionId);
    if (result) return result;
  }
  return null;
}

module.exports = { resolveFreeformAction };
