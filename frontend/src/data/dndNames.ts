// Backend'deki data/dnd.js ile aynı id->isim eşlemesi (görüntüleme amaçlı, senkron erişim gerekiyor).

export const RACE_NAMES: Record<string, string> = {
  human: 'İnsan',
  elf: 'Elf',
  dwarf: 'Cüce',
  halfling: 'Halfling',
  orc: 'Ork',
};

export const CLASS_NAMES: Record<string, string> = {
  fighter: 'Savaşçı',
  wizard: 'Büyücü',
  rogue: 'Hırsız',
  cleric: 'Rahip',
};
