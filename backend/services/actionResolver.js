const { rollD20 } = require("./dice");

const DIFFICULTY_CLASS = 12;

// \b Türkçe harflerde (ı, ş, ç, ğ, ö, ü) çalışmaz (\w sadece ASCII kapsar),
// bu yüzden kelime başlangıcını Türkçe harfleri de tanıyan bir sınıfla elle kontrol ediyoruz.
// Kökün kelime SONUNDA sınırlanmaması bilinçli: Türkçe eklemeli bir dil olduğu için
// ekler kökle bitişik yazılır (örn. "saldır" + "ıyorum").
const WORD_START = "(?:^|[^a-zçğıiöşü])";

function buildCategoryPattern(roots) {
  return new RegExp(`${WORD_START}(?:${roots.join("|")})`);
}

// Bağımsız tester QA'sının bulduğu bug (Faz 12-A sonrası, TASKS.md'de repro'lu):
// "kır" gibi 3 harften kısa/çok genel kökler WORD_START'ın (sadece kelime
// BAŞINI çapalıyor, eklemeli dil yüzünden kelime SONU çapası yok) sağladığı
// korumayı aşıyor - "kırmızı" gibi tamamen alakasız kelimelerle de eşleşiyor.
// Faz 3-D'den beri buradaydı ama önceden sadece anlatım rengi (flavor)
// seçiyordu, düşük riskliydi. Faz 12-A bu tespiti GERÇEK mekaniğe (hasar)
// bağlayınca risk seviyesi değişti - kısa kökü daha spesifik/çekim-farkında
// formlarla değiştirdik.
const STR_PATTERN = buildCategoryPattern([
  "vur",
  "sald[ıi]r",
  "attack",
  "dövüş",
  "kırıyor",
  "kırarım",
  "kıracağım",
  "kırdım",
  // Emir kipi ("Kapıyı kır") ek almadan kullanılabildiğinden yukarıdaki
  // çekimli formlar bunu yakalamaz - "kır" burada AYRICA kelime SONUNDA da
  // çapalanıyor (negatif lookahead: ardından harf gelmemeli) ki "kırmızı"
  // gibi kelimelerin başındaki "kır" ile hâlâ çakışmasın.
  "kır(?![a-zçğıiöşü])",
  "zorla",
]);
const WIS_PATTERN = buildCategoryPattern(["bak", "incele", "gözlemle", "look", "araştır", "search", "dinle"]);
const CHA_PATTERN = buildCategoryPattern(["konuş", "sor", "talk", "ikna", "soru", "pazarlık"]);
const DEX_PATTERN = buildCategoryPattern(["gizlen", "sıvış", "hızlı", "çevik", "atla", "tırman"]);

// Faz 12-A: serbest-form savaş/eşya niyeti algılama - STR_PATTERN zaten
// "saldırı" fiillerini ayırt ediyordu (önceden sadece anlatım rengi için
// kullanılıyordu), burada GERÇEK mekanik bir sonucu (hasar/HP) tetiklemek
// için de kullanılıyor. Al/topla ve iç/kullan ayrı iki niyet - biri sahnedeki
// loot'u envantere taşır, diğeri envanterdeki bir iksiri tüketir.
//
// Yukarıdaki "kır" bug'ıyla AYNI sınıf: "al" (2 harf) "altın"/"almanya"/
// "alışveriş" gibi bambaşka kelimelerin BAŞINDA da geçiyor, "iç" (2 harf)
// "içeri"/"içinde"/"içimden" gibi son derece yaygın kelimelerle çakışıyor -
// ikisi de bare kısa kök yerine spesifik/çekim-farkında formlarla değiştirildi.
// "topla" kökü Türkçe geniş zaman/şimdiki zaman çekiminde ünlü düşmesiyle
// "topluyorum"/"topluyor" olur (kök "topla" harfiyen geçmez) - "toplu" ayrıca eklendi.
const PICKUP_PATTERN = buildCategoryPattern([
  "alıyor",
  "alırım",
  "alacağım",
  "aldım",
  "topla",
  "toplu",
  "kaldır",
  "pick up",
]);
const CONSUME_PATTERN = buildCategoryPattern(["içiyor", "içerim", "içeceğim", "içtim", "kullan", "tüket", "drink"]);

function isAttackIntent(text) {
  return STR_PATTERN.test((text || "").toLocaleLowerCase("tr"));
}

function isPickupIntent(text) {
  return PICKUP_PATTERN.test((text || "").toLocaleLowerCase("tr"));
}

function isConsumeIntent(text) {
  return CONSUME_PATTERN.test((text || "").toLocaleLowerCase("tr"));
}

function abilityModifier(score) {
  return Math.floor(((score ?? 10) - 10) / 2);
}

function detectActionAttribute(text) {
  const t = (text || "").toLocaleLowerCase("tr");
  if (STR_PATTERN.test(t)) return "str";
  if (WIS_PATTERN.test(t)) return "wis";
  if (CHA_PATTERN.test(t)) return "cha";
  if (DEX_PATTERN.test(t)) return "dex";
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

module.exports = {
  resolveAction,
  detectActionAttribute,
  abilityModifier,
  DIFFICULTY_CLASS,
  isAttackIntent,
  isPickupIntent,
  isConsumeIntent,
};
