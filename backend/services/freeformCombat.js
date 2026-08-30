// Faz 12-A (serbest-form mimari sıfırlaması): `/chat`'teki serbest metinden
// GERÇEK mekanik sonuçlar (hasar/HP, XP/level, envanter) üretir. Saldırı
// mekaniği, grid'in `routes/scene.js`'teki `/attack` route'uyla AYNI D20+
// hasar/XP mantığını kullanır (primary attribute, silah hasar zarı, kritik
// vuruş) - tek fark hedefin bitişik/menzil kontrolü olmaması (x/y yok) ve
// hedefin metinden isim eşleşmesiyle seçilmesi (yoksa ilk canlı düşman).
const { rollD20, rollDie } = require("./dice");
const {
  abilityModifier,
  DIFFICULTY_CLASS,
  isAttackIntent,
  isPickupIntent,
  isConsumeIntent,
  isEquipIntent,
  detectSpellId,
} = require("./actionResolver");
const { CLASSES } = require("../data/dnd");
const { SPELLS } = require("../data/spells");
const { getWeaponDamageDie } = require("../data/weaponDamage");
const { getTotalArmorReduction } = require("../data/armorReduction");
const { getSlotForItem, getIconForSlot } = require("../data/itemSlots");
const { awardXp } = require("./leveling");
const { getFreeformEncounter, advanceFreeformEncounter } = require("./freeformEncounter");
const { nanoid } = require("nanoid");

// Fikir #21/#35'in grid'deki aynı üst sınırı (routes/scene.js: MAX_INVENTORY) -
// serbest-form loot toplama da aynı kurala tabi.
const MAX_INVENTORY = 30;
// scene.js'in /item/use'daki aynı iyileştirme miktarı ("iksir" adı geçen her eşya).
const POTION_HEAL_AMOUNT = 5;
// Türkçe ünsüz yumuşaması: bir isme çekim eki (ör. belirtme hâli "-ı")
// eklenince son sert ünsüz karşılık gelen yumuşak ünsüze döner ("Kılıç" +
// "-ı" → "Kılıcı"). Fikir #93: eşya adı eşleştirmesi bu yüzden "Kısa Kılıç"
// gibi bir ismi "Kısa Kılıcı kuşanıyorum" metninde literal olarak bulamıyordu
// - eskiden bu, güvensiz bir "ilk eşyaya düş" fallback'iyle maskeleniyordu
// (asıl bug), o kaldırılınca isim eşleştirmenin kendisinin bu yaygın durumu
// da kapsaması gerekti.
const CONSONANT_SOFTENING = { p: "b", ç: "c", t: "d", k: "ğ" };

function nameMatchesText(itemName, lowerText) {
  const lowerName = itemName.toLocaleLowerCase("tr");
  if (lowerText.includes(lowerName)) return true;
  const lastChar = lowerName.slice(-1);
  const softened = CONSONANT_SOFTENING[lastChar];
  if (!softened) return false;
  return lowerText.includes(lowerName.slice(0, -1) + softened);
}
// services/enemyAI.js'teki AYNI sabitler (runEnemyTurn) - grid'in düşman
// saldırı dengesiyle tutarlı kalması için.
const ENEMY_ATTACK_MODIFIER = 2;
const ENEMY_DAMAGE_DIE = 6;

// Faz 12-C-hazırlık 2 (PM onaylı): freeform'da hiç düşman karşılığı yoktu -
// oyuncu sonsuza kadar hasarsız saldırabiliyordu, ölüm riski/gerginlik hiç
// yoktu. `enemyAI.js`'teki AYNI D20+hasar+zırh-indirimi mantığı (x/y/hareket
// kısmı hariç, freeform'da anlamsız) - sadece oyuncunun KENDİ saldırı/saldırı
// büyüsü aksiyonundan SONRA, hâlâ canlı düşman varsa TEK bir düşman karşılık
// veriyor (PM ile kararlaştırıldığı gibi - hepsi değil, basitleştirme).
function resolveEnemyRetaliation(character, state, preferredEnemyId) {
  if (state.enemies.length === 0 || character.hp.current <= 0) return null;
  const attacker = state.enemies.find((e) => e.id === preferredEnemyId) ?? state.enemies[0];

  const roll = rollD20();
  const total = roll + ENEMY_ATTACK_MODIFIER;
  if (roll === 1 || total < DIFFICULTY_CLASS) {
    return { enemyName: attacker.name, hit: false };
  }

  const rawDamage = rollDie(ENEMY_DAMAGE_DIE) + (roll === 20 ? ENEMY_DAMAGE_DIE : 0);
  const armorReduction = getTotalArmorReduction(character);
  const damage = Math.max(0, rawDamage - armorReduction);
  character.hp.current = Math.max(0, character.hp.current - damage);

  return { enemyName: attacker.name, hit: true, damage };
}

// Yaratıcı cron fikir #93'ün resolveEquip'te düzelttiği AYNI bug sınıfı:
// eskiden isim eşleşmeyince (`?? state.enemies[0]`) sessizce İLK düşmana
// düşülüyordu. Tek düşmanlı karşılaşmalarda (havuzdaki çoğu) zaten belirsizlik
// yok - ama "İskelet Mezarlığı" gibi çoklu düşmanlı bir karşılaşmada, oyuncu
// var olmayan/artık ölü bir ismi ("Okçu'ya vur" ama sadece Savaşçı kaldıysa)
// yazınca bu, alakasız bir düşmana yanlışlıkla saldırıyordu. Birden fazla
// düşman varken isim eşleşmezse hiç hedef seçilmiyor (mekanik sonuç `null`).
function findTargetEnemy(state, text) {
  const lower = (text || "").toLocaleLowerCase("tr");
  const named = state.enemies.find((e) => lower.includes(e.name.toLocaleLowerCase("tr")));
  if (named) return named;
  return state.enemies.length === 1 ? state.enemies[0] : null;
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

  const enemyRetaliation = resolveEnemyRetaliation(character, state, target.id);

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
    enemyRetaliation,
  };
}

// Faz 12-C-hazırlık: `/cast`'in AYNI mana kontrolü + D20+hasar/iyileştirme
// mantığı - tek gerçek fark, Ateş Topu'nun grid'deki "bitişik hücreler"
// (Manhattan mesafe) AoE'si yerine (x/y yok) mevcut karşılaşmadaki TÜM canlı
// düşmanlara isabet etmesi (PM onaylı: kavramsal olarak tutarlı bir uyarlama).
function resolveCast(character, sessionId, text) {
  const spellId = detectSpellId(text);
  if (!spellId) return null;
  if (!character.mana || character.mana.max <= 0) return null;

  const spell = SPELLS[spellId];
  if (character.mana.current < spell.manaCost) return null;

  if (spell.type === "heal") {
    character.mana.current -= spell.manaCost;
    const healed = Math.min(character.hp.max, character.hp.current + spell.healAmount) - character.hp.current;
    character.hp.current = Math.min(character.hp.max, character.hp.current + spell.healAmount);
    return { kind: "cast", spell: { id: spell.id, name: spell.name }, healed };
  }

  // Saldırı büyüsü (Ateş Topu) - hedef gerektirir, freeform'da bu "mevcut
  // karşılaşmadaki tüm canlı düşmanlar" demek.
  const state = getFreeformEncounter(sessionId);
  if (state.enemies.length === 0) return null;

  character.mana.current -= spell.manaCost;

  const primaryAttribute = CLASSES[character.class]?.primaryAttribute ?? "int";
  const modifier = abilityModifier(character.attributes[primaryAttribute]);
  const roll = rollD20();
  const total = roll + modifier;

  let outcome;
  if (roll === 20) outcome = "critical-success";
  else if (roll === 1) outcome = "critical-failure";
  else if (total >= DIFFICULTY_CLASS) outcome = "success";
  else outcome = "failure";

  const blastHits = [];
  if (outcome === "success" || outcome === "critical-success") {
    for (const enemy of state.enemies) {
      const enemyDamage = rollDie(spell.damageDie) + (outcome === "critical-success" ? rollDie(spell.damageDie) : 0);
      enemy.hp = Math.max(0, enemy.hp - enemyDamage);
      blastHits.push({ id: enemy.id, name: enemy.name, damage: enemyDamage, defeated: enemy.hp <= 0 });
    }
    const defeatedIds = new Set(blastHits.filter((h) => h.defeated).map((h) => h.id));
    state.enemies = state.enemies.filter((e) => !defeatedIds.has(e.id));
  }

  let levelsGained = 0;
  for (const hit of blastHits) {
    if (hit.defeated) levelsGained += awardXp(character, primaryAttribute);
  }

  let encounterCleared = false;
  let nextEncounterName = null;
  let completedFullLap = false;
  if (blastHits.length > 0 && state.enemies.length === 0) {
    encounterCleared = true;
    const next = advanceFreeformEncounter(sessionId);
    nextEncounterName = next.name;
    completedFullLap = next.completedFullLap;
  }

  const enemyRetaliation = resolveEnemyRetaliation(character, state);

  return {
    kind: "cast",
    spell: { id: spell.id, name: spell.name },
    actionResult: { attribute: primaryAttribute, roll, modifier, total, dc: DIFFICULTY_CLASS, outcome },
    blastHits,
    levelsGained,
    encounterCleared,
    nextEncounterName,
    completedFullLap,
    enemyRetaliation,
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

// Faz 12-C-hazırlık 2: grid'in `/item/equip`'iyle AYNI paper-doll mantığı
// (aynı slotta başka bir şey kuşanılıysa önce onu çıkar). Türkçe'de bir eşyaya
// çekim eki eklenince ünsüz yumuşaması olabileceğinden ("Kılıç" + "-ı" →
// "Kılıcı") tam ad her zaman birebir metinde geçmeyebilir - `nameMatchesText`
// bu yumuşamayı da dener. İsim hiç eşleşmezse (fikir #93) hiç mekanik sonuç
// üretilmez - sahip olunmayan bir eşyaya sessizce başka bir eşyaya düşülmez.
function resolveEquip(character, text) {
  const equippable = character.inventory.filter((i) => i.slot);
  if (equippable.length === 0) return null;

  // Yaratıcı cron fikir #93: eskiden isim eşleşmeyince (`?? equippable[0]`)
  // İLK kuşanılabilir eşyaya sessizce düşülüyordu - sahip olunmayan bir eşya
  // istenince (ör. hiç miğfer yokken "Miğferimi takıyorum") bu, alakasız bir
  // eşyayı (ör. kuşanılı kılıcı) yanlışlıkla çıkarabiliyordu. `resolveAttack`
  // gibi TEK bir aday varken belirsizlik yaşanmayan bir durumdan farklı olarak
  // (birden fazla eşya olabilir), burada isim eşleşmezse hiç mekanik sonuç
  // üretilmiyor.
  const lower = (text || "").toLocaleLowerCase("tr");
  const item = equippable.find((i) => nameMatchesText(i.name, lower));
  if (!item) return null;

  if (item.equipped) {
    item.equipped = false;
  } else {
    for (const other of character.inventory) {
      if (other.id !== item.id && other.slot === item.slot && other.equipped) {
        other.equipped = false;
      }
    }
    item.equipped = true;
  }

  return { kind: "equip", item: { id: item.id, name: item.name }, equipped: item.equipped };
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

// Öncelik sırası: büyü > saldırı > eşya kullan > eşya al - bir mesaj birden
// fazla kalıba uysa bile (nadir) TEK bir mekanik sonuç üretilir, anlatım
// karışmaz. Büyü en başta çünkü tespiti en spesifik/kasıtlı sinyal (büyünün
// kendi adının geçmesi) - bir sınıfın büyüsü yoksa/manası yetmezse
// resolveCast zaten null döner, sıradaki kontrole (saldırı) düşülür.
function resolveFreeformAction(character, sessionId, text) {
  // Yaratıcı cron fikir #92: ölü bir karakter (hp<=0) için hiçbir kontrol
  // yoktu - hiçbir resolveXxx() hp>0 kontrolü yapmıyordu, chat.js'de de ayrı
  // bir kontrol bulunmuyordu. Burada tek noktadan (savunma katmanı olarak,
  // asıl engel chat.js'in erken dönüşü) kapatılıyor.
  if (!character || character.hp.current <= 0) return null;

  const castResult = resolveCast(character, sessionId, text);
  if (castResult) return castResult;

  if (isAttackIntent(text)) {
    const result = resolveAttack(character, sessionId, text);
    if (result) return result;
  }
  if (isConsumeIntent(text)) {
    const result = resolveConsume(character);
    if (result) return result;
  }
  if (isEquipIntent(text)) {
    const result = resolveEquip(character, text);
    if (result) return result;
  }
  if (isPickupIntent(text)) {
    const result = resolvePickup(character, sessionId);
    if (result) return result;
  }
  return null;
}

module.exports = { resolveFreeformAction };
