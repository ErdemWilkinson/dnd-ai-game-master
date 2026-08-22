// Faz 4: paper-doll ekipman sistemi. Eşya adından slot'a eşleme.
// Slot'u olmayan eşyalar (null) kuşanılamaz (iksir, kutsal sembol, hırsız aletleri vb.).

const SLOTS = ["head", "chest", "arms", "legs", "feet", "hand"];

const ITEM_SLOTS = {
  "Kısa Kılıç": "hand",
  "Hançer x2": "hand",
  Asa: "hand",
  Topuz: "hand",
  Kalkan: "arms",
  "Deri Zırh": "chest",
  "Büyü Kitabı": null,
  "Hırsız Aletleri": null,
  "Kutsal Sembol": null,
  "İksir (Küçük İyileştirme)": null,
};

function getSlotForItem(itemName) {
  return ITEM_SLOTS[itemName] ?? null;
}

module.exports = { SLOTS, ITEM_SLOTS, getSlotForItem };
