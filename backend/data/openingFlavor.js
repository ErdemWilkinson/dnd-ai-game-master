// Kural tabanlı / şablon açılış hikayeleri (Faz 3 - AI yoksa/hata verirse mock'a düşülür).

const OPENING_TEMPLATES = [
  (name) =>
    `${name}, gözlerini soğuk taş bir zeminde açıyorsun. Başının üstünde damlayan su sesleri yankılanıyor, nasıl buraya geldiğini hatırlamıyorsun. Yanında sadece eşyaların ve belirsiz bir tehlike hissi var.`,
  (name) =>
    `${name}, uzun bir yolculuğun ardından bu terk edilmiş mahzenin girişine varıyorsun. Havada küf ve nem kokusu var, içeriden hafif bir hışırtı geliyor.`,
  (name) =>
    `${name}, meşale ışığında etrafına bakınıyorsun. Bu yer haritalarda işaretli değildi; yine de içgüdülerin seni buraya sürükledi. Macera şimdi başlıyor.`,
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generateOpeningMock(character) {
  const template = pickRandom(OPENING_TEMPLATES);
  return template(character?.name ?? "Kahraman");
}

module.exports = { generateOpeningMock };
