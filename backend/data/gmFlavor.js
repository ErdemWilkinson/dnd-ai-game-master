// Kural tabanlı / şablon GM cevapları (Faz 1 - gerçek LLM yok).

const GENERIC_RESPONSES = [
  "Karanlık koridorun sonunda bir kapı gıcırdayarak aralanıyor. İçeri girmek ister misin?",
  "Uzaktan gelen bir hışırtı seni tetikte tutuyor. Ne yapmak istersin?",
  "Rüzgar meşalelerin alevini titretiyor, gölgeler duvarlarda oynaşıyor.",
  "Yerdeki eski işaretler bu yolun daha önce kullanıldığını gösteriyor.",
  "Bir an için sessizlik çöküyor, sonra uzaktan boğuk bir kükreme duyuluyor.",
];

const ATTACK_RESPONSES = [
  "Silahını savuruyorsun! Zar sesleri yankılanıyor... vuruş isabet ediyor gibi görünüyor.",
  "Ani bir hamleyle saldırıya geçiyorsun. Rakibin geri sekiyor.",
  "Saldırın hedefi buluyor, ama karşı taraf henüz düşmedi.",
];

const LOOK_RESPONSES = [
  "Çevrene dikkatlice bakıyorsun. Taş duvarlar, eski bir sandık ve tozlu bir raf dikkatini çekiyor.",
  "Gözlerin karanlığa alışıyor; köşede parıldayan bir şey fark ediyorsun.",
  "Etrafta kayda değer bir tehlike göremiyorsun, ama tetikte kalmakta fayda var.",
];

const TALK_RESPONSES = [
  "Karşındaki figür sana şüpheyle bakıyor ama dinlemeye değer görünüyor.",
  "\"Bunu daha önce hiç duymamıştım,\" diyor karşındaki, düşünceli bir tavırla.",
  "Sözlerin karşı tarafta bir etki yaratıyor; sana biraz daha güveniyor gibi.",
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generateGmResponse(playerMessage) {
  const text = (playerMessage || "").toLowerCase();

  if (/(vur|saldır|attack|dövüş)/.test(text)) {
    return pickRandom(ATTACK_RESPONSES);
  }
  if (/(bak|incele|gözlemle|look)/.test(text)) {
    return pickRandom(LOOK_RESPONSES);
  }
  if (/(konuş|sor|talk|soru)/.test(text)) {
    return pickRandom(TALK_RESPONSES);
  }
  return pickRandom(GENERIC_RESPONSES);
}

module.exports = { generateGmResponse };
