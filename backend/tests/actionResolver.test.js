import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { resolveAction, detectActionAttribute, abilityModifier, DIFFICULTY_CLASS } =
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

  it("BUG: wis regex'indeki `ara` anahtar kelimesi çapasız (unanchored) olduğu için Türkçe'de çok yaygın olan '-ara-' hecesini içeren HERHANGİ bir kelimeyi yanlışlıkla yakalıyor", () => {
    // /(bak|incele|gözlemle|look|ara|search|dinle)/ regex'i "ara"yı fiil
    // ("ara" = "search for") olarak yakalamayı hedefliyor, ama bir alt-dize
    // (substring) araması olduğu için "-ara-" hecesini barındıran sıradan
    // Türkçe çekim/hal ekli kelimelerde de (duvarA, kaçARAk, karanlığA...)
    // yanlışlıkla tetikleniyor — çünkü wis kontrolü str'den sonra, dex'ten
    // ÖNCE çalışıyor. Sonuç: bariz bir "çevik/dex" eylemi olan "duvara
    // tırmanmak" ya da "kaçarak sıvışmak" yanlışlıkla BİLGELİK kontrolüne
    // düşüyor. Zar mekaniğinin kendisi bozuk değil — hangi stat'ın
    // kullanılacağı yanlış seçiliyor, bu da yanlış modifier ile zar
    // atılmasına yol açabiliyor (örn. dex'i yüksek ama wis'i düşük bir
    // karakter, aslında başarması gereken bir tırmanma eylemini gereksiz
    // yere kaybedebilir). Bu test MEVCUT (hatalı) davranışı belgeliyor —
    // coder'ın TASKS.md'ye düştüğü "ı/i varyasyonu" notundan daha geniş
    // kapsamlı bir kök neden: öneri, "ara" yerine `\bara\b` gibi kelime
    // sınırlı bir regex kullanmak.
    expect(detectActionAttribute("duvara tırman")).toBe("wis"); // beklenen: dex
    expect(detectActionAttribute("kaçarak sıvışıyorum")).toBe("wis"); // beklenen: dex ("sıvış" var ama "ara" önce eşleşiyor)
    expect(detectActionAttribute("karanlığa doğru atlıyorum")).toBe("wis"); // beklenen: dex
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
