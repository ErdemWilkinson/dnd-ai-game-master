// Kural tabanlı / şablon GM cevapları (Faz 1 - gerçek LLM yok, Faz 8'de
// kullanıcı geri bildirimiyle çeşitlilik artırıldı - "sadece bir olay var,
// her şey onun üzerinden yürüyor" şikayeti üzerine havuzlar genişletildi ve
// yeni kategoriler (hareket/keşif, büyü) eklendi).

const GENERIC_RESPONSES = [
  "Karanlık koridorun sonunda bir kapı gıcırdayarak aralanıyor. İçeri girmek ister misin?",
  "Uzaktan gelen bir hışırtı seni tetikte tutuyor. Ne yapmak istersin?",
  "Rüzgar meşalelerin alevini titretiyor, gölgeler duvarlarda oynaşıyor.",
  "Yerdeki eski işaretler bu yolun daha önce kullanıldığını gösteriyor.",
  "Bir an için sessizlik çöküyor, sonra uzaktan boğuk bir kükreme duyuluyor.",
  "Taşların arasından sızan soğuk hava, ensendeki tüyleri diken diken ediyor.",
  "Uzak bir yerden metal şıngırtısı duyuluyor; biri ya da bir şey yakınlarda.",
  "Yerdeki toz tabakası, buraya uzun süredir kimsenin uğramadığını gösteriyor.",
  "Ayak seslerinin yankısı taş duvarlarda tuhaf bir şekilde çoğalıyor.",
  "İçgüdülerin sana dikkatli olmanı söylüyor, ama macera çağırıyor.",
];

const ATTACK_RESPONSES = [
  "Silahını savuruyorsun! Zar sesleri yankılanıyor... vuruş isabet ediyor gibi görünüyor.",
  "Ani bir hamleyle saldırıya geçiyorsun. Rakibin geri sekiyor.",
  "Saldırın hedefi buluyor, ama karşı taraf henüz düşmedi.",
  "Öfkeyle atılıyorsun, silahın havayı yarıyor.",
  "Rakibin son anda savuşturmaya çalışıyor ama tam yetişemiyor.",
  "Kaslarını gererek vuruşuna tüm gücünü katıyorsun.",
];

const LOOK_RESPONSES = [
  "Çevrene dikkatlice bakıyorsun. Taş duvarlar, eski bir sandık ve tozlu bir raf dikkatini çekiyor.",
  "Gözlerin karanlığa alışıyor; köşede parıldayan bir şey fark ediyorsun.",
  "Etrafta kayda değer bir tehlike göremiyorsun, ama tetikte kalmakta fayda var.",
  "Duvarlardaki oyma desenler eski ve unutulmuş bir dile ait gibi görünüyor.",
  "Gölgeler arasında hareket eden bir şey seni bir an tedirgin ediyor, sonra kayboluyor.",
  "Dikkatli bakışların, gizli bir mekanizmanın izlerini yakalıyor olabilir.",
];

const TALK_RESPONSES = [
  "Karşındaki figür sana şüpheyle bakıyor ama dinlemeye değer görünüyor.",
  "\"Bunu daha önce hiç duymamıştım,\" diyor karşındaki, düşünceli bir tavırla.",
  "Sözlerin karşı tarafta bir etki yaratıyor; sana biraz daha güveniyor gibi.",
  "Karşındaki bir süre sessiz kalıp seni tartıyor, sonra dikkatle dinlemeye başlıyor.",
  "\"Kelimelerine dikkat et, buralarda herkes dost değildir,\" diye fısıldıyor karşındaki.",
];

const MOVE_RESPONSES = [
  "Adım adım ilerliyorsun, zemin ayaklarının altında hafifçe çatırdıyor.",
  "Dikkatle ilerlerken önündeki yol yavaş yavaş açığa çıkıyor.",
  "Karanlığa doğru ilerliyorsun, meşalenin ışığı seninle birlikte hareket ediyor.",
  "Sessizce keşfe devam ediyorsun, her köşe yeni bir olasılık barındırıyor.",
  "Adımların yankılanıyor; buranın ne kadar derin olduğunu şimdi anlıyorsun.",
];

const MAGIC_RESPONSES = [
  "Parmak uçlarında biriken enerji havayı titretiyor.",
  "Büyünün gücü içinden akarken kısa bir an dünya donuyor gibi hissediyorsun.",
  "Ellerinin arasında beliren ışık, karanlığı bir anlığına geri püskürtüyor.",
  "Arkane sözcükler dudaklarından dökülürken havada görünmez bir titreşim yayılıyor.",
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Yaratıcı cron fikir #110: bu kategori regex'leri actionResolver.js'de
// fikir #88/#93'te düzeltilen AYNI bug sınıfını taşıyordu - "bak"/"git"/
// "sor"/"vur" gibi kısa/genel kökler WORD_START'ın (sadece kelime BAŞINI
// çapalar) sağladığı korumayı aşıp "bakkal"/"gitar"/"sorun"/"vurgu" gibi
// bambaşka kelimelerle de eşleşiyordu. actionResolver.js'deki AYNI disiplin
// uygulandı: kısa kökler bare eklenmedi, sadece çekimli formlar + kelime-
// sonu çapalı (negatif lookahead) emir kipi. Bu SADECE mock-fallback'in
// atmosferik cümle seçimini etkiliyor (gerçek mekanik sonuç tetiklemiyor),
// bu yüzden actionResolver'daki kadar geniş bir çekim seti gerekmedi.
const WORD_START = "(?:^|[^a-zçğıiöşü])";

function buildCategoryPattern(roots) {
  return new RegExp(`${WORD_START}(?:${roots.join("|")})`);
}

const ATTACK_PATTERN = buildCategoryPattern([
  "vuruyor",
  "vururum",
  "vuracağım",
  "vurdum",
  "vurup",
  "vur(?![a-zçğıiöşü])",
  "sald[ıi]r",
  "attack",
  "dövüş",
  "hücum",
]);
const LOOK_PATTERN = buildCategoryPattern([
  "bakıyor",
  "bakarım",
  "bakacağım",
  "baktım",
  "bakıp",
  "bak(?![a-zçğıiöşü])",
  "incele",
  "gözlemle",
  "look",
  "araştır",
  "kontrol et",
]);
const TALK_PATTERN = buildCategoryPattern([
  "konuş",
  "talk",
  "seslen",
  "soruyor",
  "sorarım",
  "soracağım",
  "sordum",
  "sorup",
  "sor(?![a-zçğıiöşü])",
]);
const MAGIC_PATTERN = buildCategoryPattern(["büyü", "sihir", "cast", "efsun"]);
const MOVE_PATTERN = buildCategoryPattern([
  "gidiyor",
  "giderim",
  "gideceğim",
  "gittim",
  "gidip",
  "gitmek",
  "gitme",
  "git(?![a-zçğıiöşü])",
  "yürü",
  "ilerle",
  "keşfet",
  "yaklaş",
  "koş",
]);

function generateGmResponse(playerMessage) {
  const text = (playerMessage || "").toLowerCase();

  if (ATTACK_PATTERN.test(text)) {
    return pickRandom(ATTACK_RESPONSES);
  }
  if (LOOK_PATTERN.test(text)) {
    return pickRandom(LOOK_RESPONSES);
  }
  if (TALK_PATTERN.test(text)) {
    return pickRandom(TALK_RESPONSES);
  }
  if (MAGIC_PATTERN.test(text)) {
    return pickRandom(MAGIC_RESPONSES);
  }
  if (MOVE_PATTERN.test(text)) {
    return pickRandom(MOVE_RESPONSES);
  }
  return pickRandom(GENERIC_RESPONSES);
}

module.exports = { generateGmResponse };
