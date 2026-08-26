import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { ENCOUNTERS } = require("../data/encounters.js");

describe("data/encounters.js", () => {
  it("en az 2 farklı karşılaşma tanımlı, her biri isim + en az 1 düşman içerir", () => {
    expect(ENCOUNTERS.length).toBeGreaterThanOrEqual(2);
    for (const encounter of ENCOUNTERS) {
      expect(typeof encounter.name).toBe("string");
      expect(encounter.enemies.length).toBeGreaterThan(0);
    }
  });

  it("her karşılaşmadaki düşman id'leri global olarak benzersiz (route'lar id ile arıyor)", () => {
    const allIds = ENCOUNTERS.flatMap((e) => e.enemies.map((en) => en.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
