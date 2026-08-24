// Faz 6-C: basit XP/seviye sistemi. 5e'nin tam XP tablosu yerine düz bir formül.

const XP_PER_KILL = 20;
const HP_GAIN_PER_LEVEL = 2;
const MANA_GAIN_PER_LEVEL = 2;
// Yaratıcı cron fikir #31: seviye üst sınırı yoktu, sonsuz döngüdeki
// karşılaşmalarla teorik olarak sınırsız büyüyebilirdi - 5e'nin geleneksel
// tavanı (20) eklendi.
const MAX_LEVEL = 20;

function xpToNextLevel(level) {
  return level * 50;
}

// Karakteri mutasyona uğratır (referansla), kaç seviye atlandığını döner (0 = atlamadı).
function awardXp(character, classPrimaryAttribute, amount = XP_PER_KILL) {
  if (character.level >= MAX_LEVEL) return 0;

  character.xp = (character.xp ?? 0) + amount;
  let levelsGained = 0;

  while (character.level < MAX_LEVEL && character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level);
    character.level += 1;
    levelsGained += 1;

    character.hp.max += HP_GAIN_PER_LEVEL;
    character.hp.current = character.hp.max;

    if (character.mana.max > 0) {
      character.mana.max += MANA_GAIN_PER_LEVEL;
      character.mana.current = character.mana.max;
    }

    if (classPrimaryAttribute && character.attributes[classPrimaryAttribute] !== undefined) {
      character.attributes[classPrimaryAttribute] += 1;
    }
  }

  return levelsGained;
}

module.exports = { awardXp, xpToNextLevel, XP_PER_KILL, MAX_LEVEL };
