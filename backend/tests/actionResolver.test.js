import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { resolveAction, detectActionAttribute, abilityModifier, DIFFICULTY_CLASS, isAttackIntent, isPickupIntent, isConsumeIntent, isEquipIntent, isDropIntent, detectSpellId } =
  require("../services/actionResolver.js");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("detectActionAttribute", () => {
  it.each([
    ["goblin'e saldırıyorum", "str"],
    ["kapıyı kır", "str"],
    ["etrafı incele", "wis"],
    ["dikkatlice bak", "wis"],
    ["tüccarla konuş", "cha"],
    ["onu ikna etmeye çalışıyorum", "cha"],
    ["gizleniyorum", "dex"],
    ["bilinmeyen bir şey yapıyorum", "dex"], // varsayılan
  ])('"%s" -> %s', (text, expected) => {
    expect(detectActionAttribute(text)).toBe(expected);
  });

  it("REGRESYON (Faz 3.5 Bug B düzeltmesi, commit eb04d66): 'ara' hecesini içeren ama alakasız kelimeler artık yanlışlıkla BİLGELİK'e düşmüyor", () => {
    // Önceki hal: wis regex'indeki çapasız (unanchored) "ara" anahtar kelimesi
    // Türkçe'de çok yaygın olan "-ara-" hecesini barındıran HERHANGİ bir
    // kelimeyi (duvarA, kaçARAk, karanlığA...) yanlışlıkla yakalıyordu —
    // bu test o zaman "wis" bekleyip mevcut bug'ı belgeliyordu. Coder artık
    // WORD_START ile kelime-başı sınırı ekledi ve "ara" kökünü "araştır"
    // ile değiştirdi, bu yüzden bu üç örnek artık doğru şekilde dex'e
    // (varsayılan) düşüyor.
    expect(detectActionAttribute("duvara tırman")).toBe("dex");
    expect(detectActionAttribute("kaçarak sıvışıyorum")).toBe("dex");
    expect(detectActionAttribute("karanlığa doğru atlıyorum")).toBe("dex");
  });

  it("'araştır' kökü hâlâ gerçek bir inceleme eylemini BİLGELİK olarak doğru tespit ediyor", () => {
    expect(detectActionAttribute("odayı araştırıyorum")).toBe("wis");
  });

  it("dotsuz/dotlu ı toleransı: 'saldır' hem 'saldırıyorum' hem 'saldiriyorum' yazımında GÜÇ'e düşer", () => {
    expect(detectActionAttribute("goblin'e saldırıyorum")).toBe("str");
    expect(detectActionAttribute("goblin'e saldiriyorum")).toBe("str");
  });

  it("kelime ortasında geçen 'it' kökü artık STR'e yanlışlıkla düşmüyor (aşırı genel kök kaldırıldı)", () => {
    expect(detectActionAttribute("itiraz ediyorum")).not.toBe("str");
    expect(detectActionAttribute("onu itiyorum")).not.toBe("str");
  });
});

describe("REGRESYON (Faz 12-A sonrası bağımsız tester QA'sının bulduğu bug, TASKS.md'de repro'lu): isAttackIntent/isPickupIntent/isConsumeIntent artık masum kelimelerle yanlışlıkla eşleşmiyor", () => {
  // Faz 12-A'dan önce STR_PATTERN/kısa kökler sadece anlatım rengi (flavor)
  // seçiyordu, düşük riskliydi. Faz 12-A bu tespiti GERÇEK mekaniğe (hasar/
  // envanter mutasyonu) bağlayınca "kır" (3 harf), "al" (2 harf), "iç" (2 harf)
  // gibi çok kısa/çapasız kökler artık tehlikeli hale geldi - tester canlıda
  // "Altına bakıyorum" yazınca sessizce bir loot'un envantere eklendiğini
  // doğruladı. Kökler daha spesifik/çekim-farkında formlarla değiştirildi.
  it("isAttackIntent: 'kırmızı' gibi alakasız kelimeler artık gerçek bir saldırı zarı tetiklemiyor", () => {
    expect(isAttackIntent("Kırmızı pelerinimi çıkarıyorum")).toBe(false);
    expect(isAttackIntent("Kırlara doğru yürüyorum")).toBe(false);
  });

  it("isAttackIntent: gerçek saldırı/kırma niyetleri (çekimli VE emir kipi) hâlâ doğru tespit ediliyor", () => {
    expect(isAttackIntent("Goblin'e saldırıyorum")).toBe(true);
    expect(isAttackIntent("Kapıyı kırıyorum")).toBe(true);
    expect(isAttackIntent("Kapıyı kır")).toBe(true); // emir kipi, ek almaz
  });

  it("isPickupIntent: 'altın'/'almanya'/'alışveriş' gibi alakasız kelimeler artık gerçek bir envanter mutasyonu tetiklemiyor", () => {
    expect(isPickupIntent("Altına bakıyorum")).toBe(false);
    expect(isPickupIntent("Alacakaranlıkta yürüyorum")).toBe(false);
    expect(isPickupIntent("Almanya'dan geldim")).toBe(false);
    expect(isPickupIntent("Alkışlıyorum")).toBe(false);
    expect(isPickupIntent("Alışveriş yapıyorum")).toBe(false);
  });

  it("isPickupIntent: gerçek alma/toplama niyetleri hâlâ doğru tespit ediliyor", () => {
    expect(isPickupIntent("Yerdeki eşyayı alıyorum")).toBe(true);
    expect(isPickupIntent("Eşyayı topluyorum")).toBe(true);
    expect(isPickupIntent("Kalkanı kaldırıyorum")).toBe(true);
  });

  it("isConsumeIntent: 'içeri'/'içinde'/'içimden' gibi son derece yaygın kelimeler artık gerçek bir eşya tüketimini tetiklemiyor", () => {
    expect(isConsumeIntent("İçeri giriyorum")).toBe(false);
    expect(isConsumeIntent("Odanın içinde bakınıyorum")).toBe(false);
    expect(isConsumeIntent("İçimden bir ses diyor ki")).toBe(false);
  });

  it("isConsumeIntent: gerçek içme/kullanma niyetleri hâlâ doğru tespit ediliyor", () => {
    expect(isConsumeIntent("İksiri içiyorum")).toBe(true);
    expect(isConsumeIntent("İksiri kullanıyorum")).toBe(true);
  });

  it("İnovasyon fikri #88: isPickupIntent'teki 'kaldır' kökü artık 'kaldırım' gibi alakasız bir kelimeyle çakışmıyor, gerçek kaldırma niyetleri (çekimli VE emir kipi) hâlâ çalışıyor", () => {
    expect(isPickupIntent("Kaldırımda yürüyorum")).toBe(false);
    expect(isPickupIntent("Kalkanı kaldırıyorum")).toBe(true);
    expect(isPickupIntent("Kalkanı kaldır")).toBe(true); // emir kipi, ek almaz
  });

  it("İnovasyon fikri #95 (yaratıcı cron taraması): fiil zincirleme için yaygın '-ip/-ıp' bağlaç eki artık dört niyet kalıbında da tespit ediliyor", () => {
    expect(isConsumeIntent("İksiri içip iyileşiyorum")).toBe(true);
    expect(isPickupIntent("Altını alıp kaçıyorum")).toBe(true);
    expect(isPickupIntent("Kalkanı kaldırıp fırlatıyorum")).toBe(true);
    expect(isEquipIntent("Kılıcı kuşanıp savaşıyorum")).toBe(true);
    expect(isEquipIntent("Zırhı giyip meydan okuyorum")).toBe(true);
    expect(isEquipIntent("Miğferi takıp ilerliyorum")).toBe(true);
    expect(isAttackIntent("Kapıyı kırıp giriyorum")).toBe(true);
  });

  it("İnovasyon fikri #95: '-ip/-ıp' eki eklenirken yakın/benzer kelimelerle yeni bir yanlış-pozitif oluşmadı", () => {
    expect(isEquipIntent("Onu takip ediyorum")).toBe(false); // takip ≠ takıp
    expect(isPickupIntent("Alıcı bekliyorum")).toBe(false); // alıcı ≠ alıp
    expect(isPickupIntent("Kaldırımda yürüyorum")).toBe(false); // fikir #88 regresyonu yok
  });
});

describe("Faz 12-C-hazırlık: detectSpellId", () => {
  it("büyünün Türkçe adı metinde geçince doğru spellId'yi döner", () => {
    expect(detectSpellId("Ateş Topu büyüsünü fırlatıyorum")).toBe("fireball");
    expect(detectSpellId("Kendime İyileştir büyüsünü uyguluyorum")).toBe("heal");
  });

  it("hiçbir büyü adı geçmiyorsa null döner", () => {
    expect(detectSpellId("Goblin'e saldırıyorum")).toBeNull();
    expect(detectSpellId("Etrafı inceliyorum")).toBeNull();
  });

  it("İnovasyon fikri #90: tam büyü adı içermeyen ama doğal/eşanlamlı ifadeler de doğru spellId'yi döner", () => {
    expect(detectSpellId("Alev topu fırlatıyorum")).toBe("fireball");
    expect(detectSpellId("Ateş küresi oluşturuyorum")).toBe("fireball");
    expect(detectSpellId("Ateş büyüsü kullanıyorum")).toBe("fireball");
    expect(detectSpellId("Kendimi tedavi ediyorum")).toBe("heal");
  });

  it("İnovasyon fikri #90: genişletilmiş eşleşme kısa-kök ailesindeki (fikir #88) hatayı tekrarlamıyor - alakasız cümleler hâlâ null döner", () => {
    expect(detectSpellId("Kırmızı bir alev görüyorum uzakta")).toBeNull();
    expect(detectSpellId("Ateşin yanına oturuyorum")).toBeNull();
  });
});

describe("Faz 12-C-hazırlık 2: isEquipIntent", () => {
  it("gerçek kuşanma niyetleri (çekimli VE emir kipi) doğru tespit ediliyor", () => {
    expect(isEquipIntent("Kısa Kılıcı kuşanıyorum")).toBe(true);
    expect(isEquipIntent("Zırhı giyiyorum")).toBe(true);
    expect(isEquipIntent("Kalkanı takıyorum")).toBe(true);
    expect(isEquipIntent("Kılıcı kuşan")).toBe(true); // emir kipi, ek almaz
  });

  it("fikir #88'in aynı sınıfından bir hata tekrarlanmıyor - 'taktik'/'takas' gibi alakasız kelimeler tetiklenmiyor", () => {
    expect(isEquipIntent("Taktik bir hamle yapıyorum")).toBe(false);
    expect(isEquipIntent("Takas yapıyorum")).toBe(false);
  });
});

describe("İnovasyon fikri #96: isDropIntent", () => {
  it("gerçek bırakma niyetleri (çekimli VE emir kipi) doğru tespit ediliyor", () => {
    expect(isDropIntent("Kısa Kılıcı bırakıyorum")).toBe(true);
    expect(isDropIntent("Kalkanı atıyorum")).toBe(true);
    expect(isDropIntent("Kılıcı bırak")).toBe(true); // emir kipi, ek almaz
  });

  it("fikir #88'in aynı sınıfından bir hata tekrarlanmıyor - 'atlıyorum'/'satıyorum'/'yatıyorum' gibi alakasız kelimeler tetiklenmiyor", () => {
    expect(isDropIntent("Duvardan atlıyorum")).toBe(false);
    expect(isDropIntent("Eşyayı satıyorum")).toBe(false);
    expect(isDropIntent("Yere yatıyorum")).toBe(false);
    expect(isDropIntent("Uzun uzun anlatıyorum")).toBe(false);
  });

  it("fikir #95'in '-ip/-ıp' bağlaç eki desteği burada da çalışıyor", () => {
    expect(isDropIntent("Kılıcı bırakıp kaçıyorum")).toBe(true);
    expect(isDropIntent("Kalkanı atıp koşuyorum")).toBe(true);
  });
});

describe("abilityModifier", () => {
  it.each([
    [10, 0],
    [11, 0],
    [12, 1],
    [8, -1],
    [20, 5],
    [1, -5],
  ])("score %i -> modifier %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });

  it("score verilmezse 10 varsayılır (modifier 0)", () => {
    expect(abilityModifier(undefined)).toBe(0);
  });
});

describe("resolveAction", () => {
  const character = { attributes: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };

  it("nat 20 her zaman critical-success döner (toplam DC altında olsa bile)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999); // rollD20 -> 20
    const weakCharacter = { attributes: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } };
    const result = resolveAction(weakCharacter, "saldırıyorum");
    expect(result.roll).toBe(20);
    expect(result.outcome).toBe("critical-success");
  });

  it("nat 1 her zaman critical-failure döner (toplam DC üstünde olsa bile)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // rollD20 -> 1
    const strongCharacter = { attributes: { str: 20, dex: 20, con: 20, int: 20, wis: 20, cha: 20 } };
    const result = resolveAction(strongCharacter, "saldırıyorum");
    expect(result.roll).toBe(1);
    expect(result.outcome).toBe("critical-failure");
  });

  it("toplam DC'ye eşit veya üstündeyse success döner", () => {
    // rollD20 -> 11 (floor(0.5*20)+1), str 14 -> modifier +2, total 13 >= DC 12
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = resolveAction(character, "saldırıyorum");
    expect(result.roll).toBe(11);
    expect(result.modifier).toBe(2);
    expect(result.total).toBe(13);
    expect(result.dc).toBe(DIFFICULTY_CLASS);
    expect(result.outcome).toBe("success");
  });

  it("toplam DC altında ve nat1/nat20 değilse failure döner", () => {
    // rollD20 -> 3 (floor(0.1*20)+1=3), zayıf karakterle (modifier -1) total 2 < DC 12
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const weakCharacter = { attributes: { str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
    const result = resolveAction(weakCharacter, "saldırıyorum");
    expect(result.roll).toBe(3);
    expect(result.outcome).toBe("failure");
  });

  it("mesajdaki eyleme göre doğru attribute'u kullanır", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const mixedCharacter = { attributes: { str: 20, dex: 10, con: 10, int: 10, wis: 6, cha: 10 } };
    const result = resolveAction(mixedCharacter, "etrafı dikkatlice incele");
    expect(result.attribute).toBe("wis"); // "incele" -> wis, str'nin yüksekliği etkilemez
  });

  it("dönüş nesnesi beklenen tüm alanları içerir", () => {
    const result = resolveAction(character, "saldırıyorum");
    expect(result).toHaveProperty("attribute");
    expect(result).toHaveProperty("roll");
    expect(result).toHaveProperty("modifier");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("dc");
    expect(result).toHaveProperty("outcome");
  });
});
