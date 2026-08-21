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
