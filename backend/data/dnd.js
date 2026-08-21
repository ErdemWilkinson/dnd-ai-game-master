// D&D 5e temelli basitleştirilmiş ırk/sınıf verileri.

const RACES = {
  human: {
    id: "human",
    name: "İnsan",
    attributeBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  },
  elf: {
    id: "elf",
    name: "Elf",
    attributeBonuses: { dex: 2, int: 1 },
  },
  dwarf: {
    id: "dwarf",
    name: "Cüce",
    attributeBonuses: { con: 2, str: 1 },
  },
  halfling: {
    id: "halfling",
    name: "Halfling",
    attributeBonuses: { dex: 2, cha: 1 },
  },
  orc: {
    id: "orc",
    name: "Ork",
    attributeBonuses: { str: 2, con: 1 },
  },
};

const CLASSES = {
  fighter: {
    id: "fighter",
    name: "Savaşçı",
    baseHp: 12,
    baseMana: 0,
    primaryAttribute: "str",
    startingInventory: ["Kısa Kılıç", "Deri Zırh", "İksir (Küçük İyileştirme)"],
  },
  wizard: {
    id: "wizard",
    name: "Büyücü",
    baseHp: 7,
    baseMana: 12,
    primaryAttribute: "int",
    startingInventory: ["Asa", "Büyü Kitabı", "İksir (Küçük İyileştirme)"],
  },
  rogue: {
    id: "rogue",
    name: "Hırsız",
    baseHp: 9,
    baseMana: 3,
    primaryAttribute: "dex",
    startingInventory: ["Hançer x2", "Hırsız Aletleri", "İksir (Küçük İyileştirme)"],
  },
  cleric: {
    id: "cleric",
    name: "Rahip",
    baseHp: 10,
    baseMana: 10,
    primaryAttribute: "wis",
    startingInventory: ["Topuz", "Kalkan", "Kutsal Sembol", "İksir (Küçük İyileştirme)"],
  },
};

const BASE_ATTRIBUTES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

module.exports = { RACES, CLASSES, BASE_ATTRIBUTES };
