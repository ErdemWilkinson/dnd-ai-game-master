import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getArmorReduction, getTotalArmorReduction } = require("../data/armorReduction.js");

describe("getArmorReduction", () => {
  it("bilinen zırh/kalkan eşyaları için doğru azaltmayı döner", () => {
    expect(getArmorReduction("Deri Zırh")).toBe(2);
    expect(getArmorReduction("Kalkan")).toBe(1);
    expect(getArmorReduction("Eski Kalkan")).toBe(1);
  });

  it("haritada olmayan bir eşya için 0 döner", () => {
    expect(getArmorReduction("İksir (Küçük İyileştirme)")).toBe(0);
    expect(getArmorReduction("Bilinmeyen Eşya")).toBe(0);
  });
});

describe("getTotalArmorReduction", () => {
  it("kuşanılı suit/back eşyalarının azaltmasını toplar", () => {
    const character = {
      inventory: [
        { name: "Deri Zırh", slot: "suit", equipped: true },
        { name: "Kalkan", slot: "back", equipped: true },
      ],
    };
    expect(getTotalArmorReduction(character)).toBe(3);
  });

  it("kuşanılmamış eşyaları saymaz", () => {
    const character = {
      inventory: [{ name: "Deri Zırh", slot: "suit", equipped: false }],
    };
    expect(getTotalArmorReduction(character)).toBe(0);
  });

  it("suit/back DIŞINDAKİ slotları saymaz (örn. hand'deki bir silah)", () => {
    const character = {
      inventory: [{ name: "Kısa Kılıç", slot: "hand", equipped: true }],
    };
    expect(getTotalArmorReduction(character)).toBe(0);
  });

  it("inventory'si olmayan/undefined bir karakter için 0 döner, çökmez", () => {
    expect(getTotalArmorReduction({})).toBe(0);
    expect(getTotalArmorReduction(undefined)).toBe(0);
  });
});
