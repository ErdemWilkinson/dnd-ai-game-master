// Faz 5-3: SS13 (tgstation ikon seti) tarzı genişletilmiş paper-doll slotları.
// Icon dosyaları frontend/public/icons/<slot>.png altında (bkz. scripts/extractIcons.js).
// "hand" (silahlar) için asset paketinde ikon yok - metin/emoji fallback kullanılıyor.

const SLOTS = [
  "head",
  "mask",
  "glasses",
  "ears",
  "neck",
  "back",
  "suit",
  "under",
  "gloves",
  "belt",
  "shoes",
  "accessories",
  "hand",
];

const ITEM_SLOTS = {
  "Kısa Kılıç": "hand",
  "Hançer x2": "hand",
  Asa: "hand",
  Topuz: "hand",
  Kalkan: "back", // SS13 slot listesinde ayrı bir "kalkan" slotu yok, en yakın karşılık "back"
  "Eski Kalkan": "back", // İskelet Mezarlığı loot'u - Kalkan ile aynı slot (fikir #41)
  "Deri Zırh": "suit",
  "Büyü Kitabı": null,
  "Hırsız Aletleri": null,
  "Kutsal Sembol": null,
  "İksir (Küçük İyileştirme)": null,
};

const SLOT_ICONS = {
  head: "/icons/head.png",
  mask: "/icons/mask.png",
  glasses: "/icons/glasses.png",
  ears: "/icons/ears.png",
  neck: "/icons/neck.png",
  back: "/icons/back.png",
  suit: "/icons/suit.png",
  under: "/icons/under.png",
  gloves: "/icons/gloves.png",
  belt: "/icons/belt.png",
  shoes: "/icons/shoes.png",
  accessories: "/icons/accessories.png",
  hand: null,
};

function getSlotForItem(itemName) {
  return ITEM_SLOTS[itemName] ?? null;
}

function getIconForSlot(slot) {
  return SLOT_ICONS[slot] ?? null;
}

module.exports = { SLOTS, ITEM_SLOTS, SLOT_ICONS, getSlotForItem, getIconForSlot };
