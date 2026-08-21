const { rollD20 } = require("./dice");

const DIFFICULTY_CLASS = 12;

function abilityModifier(score) {
  return Math.floor(((score ?? 10) - 10) / 2);
}

function detectActionAttribute(text) {
  const t = (text || "").toLocaleLowerCase("tr");
  if (/(vur|saldır|attack|dövüş|kır|it|zorla)/.test(t)) return "str";
  if (/(bak|incele|gözlemle|look|ara|search|dinle)/.test(t)) return "wis";
  if (/(konuş|sor|talk|ikna|soru|pazarlık)/.test(t)) return "cha";
  if (/(gizlen|sıvış|hızlı|çevik|atla|tırman)/.test(t)) return "dex";
  return "dex";
}

function resolveAction(character, playerText) {
  const attribute = detectActionAttribute(playerText);
  const score = character?.attributes?.[attribute];
  const modifier = abilityModifier(score);
  const roll = rollD20();
  const total = roll + modifier;

  let outcome;
  if (roll === 20) outcome = "critical-success";
  else if (roll === 1) outcome = "critical-failure";
  else if (total >= DIFFICULTY_CLASS) outcome = "success";
  else outcome = "failure";

  return { attribute, roll, modifier, total, dc: DIFFICULTY_CLASS, outcome };
}

module.exports = { resolveAction, detectActionAttribute, abilityModifier, DIFFICULTY_CLASS };
