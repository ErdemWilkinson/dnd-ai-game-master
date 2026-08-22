import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { awardXp, xpToNextLevel, XP_PER_KILL } = require("../services/leveling.js");

function freshCharacter(overrides = {}) {
  return {
    level: 1,
    xp: 0,
    hp: { current: 10, max: 10 },
    mana: { current: 5, max: 5 },
    attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ...overrides,
  };
}

describe("xpToNextLevel", () => {
  it("eşik = level * 50", () => {
    expect(xpToNextLevel(1)).toBe(50);
    expect(xpToNextLevel(2)).toBe(100);
    expect(xpToNextLevel(5)).toBe(250);
  });
});

describe("awardXp", () => {
  it("eşiğin altında kalan XP seviye atlatmaz, levelsGained 0 döner", () => {
    const character = freshCharacter();
    const levelsGained = awardXp(character, "str");

    expect(character.xp).toBe(XP_PER_KILL); // 20, eşik 50'nin altında
    expect(character.level).toBe(1);
    expect(levelsGained).toBe(0);
  });

  it("eşik aşılınca seviye atlar: HP.max/mana.max +2, primary attribute +1, HP/mana tam dolar", () => {
    const character = freshCharacter({ xp: 40 }); // 40 + 20 = 60 >= 50 (level 1 eşiği)
    character.hp.current = 3; // hasarlı
    character.mana.current = 1;

    const levelsGained = awardXp(character, "int");

    expect(levelsGained).toBe(1);
    expect(character.level).toBe(2);
    expect(character.xp).toBe(10); // 60 - 50 devreden xp
    expect(character.hp.max).toBe(12); // 10 + 2
    expect(character.hp.current).toBe(12); // tam iyileşme
    expect(character.mana.max).toBe(7); // 5 + 2
    expect(character.mana.current).toBe(7); // tam dolum
    expect(character.attributes.int).toBe(11); // primary attribute +1
  });

  it("mana.max 0 olan bir karakter (büyü kullanmayan sınıf) seviye atlarken mana kazanmaz", () => {
    const character = freshCharacter({ xp: 40, mana: { current: 0, max: 0 } });
    awardXp(character, "str");

    expect(character.mana.max).toBe(0);
    expect(character.mana.current).toBe(0);
  });

  it("tek bir büyük XP ödülü birden fazla seviye atlatabilir (döngü doğru çalışıyor)", () => {
    const character = freshCharacter();
    // level 1 eşiği 50, level 2 eşiği 100 -> toplam 150 xp ile 2 seviye atlamalı
    const levelsGained = awardXp(character, "str", 150);

    expect(levelsGained).toBe(2);
    expect(character.level).toBe(3);
    expect(character.hp.max).toBe(14); // 10 + 2*2
  });

  it("classPrimaryAttribute verilmezse ya da karakterde yoksa hata vermez, attribute'a dokunmaz", () => {
    const character = freshCharacter({ xp: 40 });
    expect(() => awardXp(character, undefined)).not.toThrow();
    expect(character.level).toBe(2); // yine de seviye atlamalı
  });

  it("varsayılan XP miktarı XP_PER_KILL (20)", () => {
    const character = freshCharacter();
    awardXp(character, "str");
    expect(character.xp).toBe(20);
    expect(XP_PER_KILL).toBe(20);
  });

  it("3 ardışık öldürme simülasyonu: 2.de henüz atlamaz, 3.de level 2'ye geçer ve 10xp devreder", () => {
    const character = freshCharacter();
    awardXp(character, "str"); // 20xp
    let levelsGained = awardXp(character, "str"); // 40xp, hâlâ level 1
    expect(character.level).toBe(1);
    expect(levelsGained).toBe(0);

    levelsGained = awardXp(character, "str"); // 60xp >= 50 eşiği
    expect(levelsGained).toBe(1);
    expect(character.level).toBe(2);
    expect(character.xp).toBe(10);
  });
});
