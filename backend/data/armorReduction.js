// Faz 10: kuşanılan zırh/kalkanın gelen hasarı sabit miktarda azaltması.
// Eşya adına göre eşleme - haritada yoksa (ör. kozmetik/aksesuar eşyalar)
// azaltma 0'dır.
// Not: "Eski Kalkan" TASKS.md'deki Faz 10 spesifikasyonunda belirtildiği
// gibi eklendi, ama bu bir loot eşyası (data/encounters.js) - loot pickup
// şu an inventory'ye hiç eklenmiyor (backend `collectedLoot` dönüyor ama
// frontend hiç kullanmıyor, ayrı/önceden var olan bir eksiklik), yani bu
// eşya pratikte asla kuşanılamıyor. Rahip'in (Cleric) GERÇEKTEN kuşanılabilen
// başlangıç eşyası "Kalkan" (data/dnd.js) - zırh mekaniğinin Rahip için de
// anlamlı olması için o da eklendi.
const ARMOR_REDUCTION = {
  "Deri Zırh": 2,
  Kalkan: 1,
  "Eski Kalkan": 1,
};

function getArmorReduction(itemName) {
  return ARMOR_REDUCTION[itemName] ?? 0;
}

// Karakterin kuşanılı "suit"/"back" slotlarındaki eşyaların toplam azaltması.
function getTotalArmorReduction(character) {
  if (!character?.inventory) return 0;
  return character.inventory
    .filter((item) => item.equipped && (item.slot === "suit" || item.slot === "back"))
    .reduce((total, item) => total + getArmorReduction(item.name), 0);
}

module.exports = { ARMOR_REDUCTION, getArmorReduction, getTotalArmorReduction };
