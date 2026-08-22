// Faz 6-C: mana kullanan sınıflar için basit büyü seçimi.

const SPELLS = {
  fireball: {
    id: "fireball",
    name: "Ateş Topu",
    type: "attack",
    manaCost: 4,
    range: 3,
    damageDie: 8,
  },
  heal: {
    id: "heal",
    name: "İyileştir",
    type: "heal",
    manaCost: 4,
    healAmount: 8,
  },
};

module.exports = { SPELLS };
