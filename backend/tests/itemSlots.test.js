import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getSlotForItem, getIconForSlot, SLOTS, ITEM_SLOTS, SLOT_ICONS } = require("../data/itemSlots.js");
const { CLASSES } = require("../data/dnd.js");

describe("getSlotForItem", () => {
  it("bilinen silah/zırh eşyaları için doğru slotu döner (Faz 5-3: SS13 slot adları)", () => {
    expect(getSlotForItem("Kısa Kılıç")).toBe("hand");
    expect(getSlotForItem("Deri Zırh")).toBe("suit");
    // SS13 slot listesinde ayrı bir "kalkan" slotu yok, en yakın karşılık "back" (coder notu, itemSlots.js).
    expect(getSlotForItem("Kalkan")).toBe("back");
  });

  it("kuşanılamayan eşyalar (iksir, kitap, kutsal sembol vb.) için null döner", () => {
    expect(getSlotForItem("İksir (Küçük İyileştirme)")).toBeNull();
    expect(getSlotForItem("Büyü Kitabı")).toBeNull();
    expect(getSlotForItem("Kutsal Sembol")).toBeNull();
    expect(getSlotForItem("Hırsız Aletleri")).toBeNull();
  });

  it("tanımsız/bilinmeyen bir eşya adı için null döner (kuşanılamaz varsayılan)", () => {
    expect(getSlotForItem("Uydurma Eşya İsmi")).toBeNull();
    expect(getSlotForItem(undefined)).toBeNull();
  });

  it("SLOTS listesi ITEM_SLOTS'taki tüm non-null değerleri kapsıyor (tutarlılık)", () => {
    const usedSlots = new Set(Object.values(ITEM_SLOTS).filter(Boolean));
    for (const slot of usedSlots) {
      expect(SLOTS).toContain(slot);
    }
  });

  it("her sınıfın başlangıç envanterindeki her eşya adı ITEM_SLOTS tablosunda tanımlı (unutulan eşya yok)", () => {
    for (const cls of Object.values(CLASSES)) {
      for (const itemName of cls.startingInventory) {
        expect(Object.prototype.hasOwnProperty.call(ITEM_SLOTS, itemName)).toBe(true);
      }
    }
  });

  it("13 SS13 slotunun hepsi SLOTS listesinde tanımlı", () => {
    expect(SLOTS).toHaveLength(13);
    expect(SLOTS).toEqual(
      expect.arrayContaining([
        "head", "mask", "glasses", "ears", "neck", "back",
        "suit", "under", "gloves", "belt", "shoes", "accessories", "hand",
      ]),
    );
  });
});

describe("getIconForSlot", () => {
  it("ikon dosyası olan slotlar için /icons/<slot>.png yolu döner", () => {
    expect(getIconForSlot("head")).toBe("/icons/head.png");
    expect(getIconForSlot("suit")).toBe("/icons/suit.png");
  });

  it("'hand' slotu için ikon yok, null döner (frontend emoji fallback kullanıyor)", () => {
    expect(getIconForSlot("hand")).toBeNull();
  });

  it("bilinmeyen bir slot için null döner", () => {
    expect(getIconForSlot("uydurma-slot")).toBeNull();
  });

  it("SLOTS listesindeki her slot için SLOT_ICONS'ta bir giriş var (unutulan slot yok)", () => {
    for (const slot of SLOTS) {
      expect(Object.prototype.hasOwnProperty.call(SLOT_ICONS, slot)).toBe(true);
    }
  });
});
