const { ATTRIBUTE_KEYS } = require("../data/dnd");

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollAttributes() {
  const rolls = {};
  for (const key of ATTRIBUTE_KEYS) {
    rolls[key] = rollD20();
  }
  return rolls;
}

module.exports = { rollD20, rollDie, rollAttributes };
