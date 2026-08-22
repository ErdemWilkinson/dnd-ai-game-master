import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { rollD20, rollDie, rollAttributes } = require("../services/dice.js");
const { ATTRIBUTE_KEYS } = require("../data/dnd.js");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rollD20", () => {
  it("her zaman 1-20 aralığında bir tam sayı döner", () => {
    for (let i = 0; i < 200; i++) {
      const value = rollD20();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(20);
    }
  });

  it("Math.random 0 iken minimum değer 1 döner", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(rollD20()).toBe(1);
  });

  it("Math.random 0.999... iken maksimum değer 20 döner", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(rollD20()).toBe(20);
  });
});

describe("rollDie (Faz 4-D: düşman hasarı için genel zar)", () => {
  it("verilen kenar sayısı (sides) aralığında bir tam sayı döner", () => {
    for (let i = 0; i < 100; i++) {
      const value = rollDie(6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it("Math.random 0 iken minimum değer 1 döner", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(rollDie(6)).toBe(1);
    expect(rollDie(20)).toBe(1);
  });

  it("Math.random 0.999... iken maksimum değer (sides) döner", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(rollDie(6)).toBe(6);
    expect(rollDie(10)).toBe(10);
  });
});

describe("rollAttributes", () => {
  it("ATTRIBUTE_KEYS içindeki her attribute için bir zar sonucu döner", () => {
    const rolls = rollAttributes();
    expect(Object.keys(rolls).sort()).toEqual([...ATTRIBUTE_KEYS].sort());
    for (const value of Object.values(rolls)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(20);
    }
  });

  it("her attribute için ayrı bir zar atılır (sabit random ile hepsi aynı değeri alır)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25); // floor(0.25*20)+1 = 6
    const rolls = rollAttributes();
    for (const key of ATTRIBUTE_KEYS) {
      expect(rolls[key]).toBe(6);
    }
  });
});
