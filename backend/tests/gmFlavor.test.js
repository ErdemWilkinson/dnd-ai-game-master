import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { generateGmResponse } = require("../data/gmFlavor.js");

describe("generateGmResponse — fikir #110: kısa kök yanlış-pozitifleri", () => {
  it("'bakkal' geçen mesaj LOOK kategorisine yanlışlıkla düşmüyor", () => {
    const text = generateGmResponse("Bakkaldan bir şey alıyorum");
    expect(text).not.toMatch(/çevrene dikkatlice|karanlığa alışıyor|kayda değer bir tehlike|oyma desenler|gizli bir mekanizma/i);
  });

  it("'gitar' geçen mesaj MOVE kategorisine yanlışlıkla düşmüyor", () => {
    const text = generateGmResponse("Gitar çalıyorum");
    expect(text).not.toMatch(/adım adım|meşalenin ışığı|sessizce keşfe|adımların yankılanıyor/i);
  });

  it("'sorun' geçen mesaj TALK kategorisine yanlışlıkla düşmüyor", () => {
    const text = generateGmResponse("Burada bir sorunumuz var");
    expect(text).not.toMatch(/şüpheyle bakıyor|daha önce hiç duymamıştım|kelimelerine dikkat et/i);
  });

  it("'vurgu' geçen mesaj ATTACK kategorisine yanlışlıkla düşmüyor", () => {
    const text = generateGmResponse("Konuşmamda vurgu yapıyorum");
    expect(text).not.toMatch(/silahını savuruyorsun|saldırıya geçiyorsun|silahın havayı yarıyor/i);
  });

  it("gerçek saldırı niyeti hâlâ ATTACK kategorisini tetikliyor (yanlış-negatif yok)", () => {
    const text = generateGmResponse("goblin'e vuruyorum");
    expect(text).toMatch(/silahını savuruyorsun|ani bir hamleyle|saldırın hedefi|öfkeyle atılıyorsun|rakibin son anda|kaslarını gererek/i);
  });

  it("gerçek bakma niyeti hâlâ LOOK kategorisini tetikliyor (yanlış-negatif yok)", () => {
    const text = generateGmResponse("etrafa bakıyorum");
    expect(text).toMatch(/çevrene dikkatlice|karanlığa alışıyor|kayda değer bir tehlike|oyma desenler|gölgeler arasında|gizli bir mekanizma/i);
  });

  it("gerçek soru sorma niyeti hâlâ TALK kategorisini tetikliyor (yanlış-negatif yok)", () => {
    const text = generateGmResponse("ona soru soruyorum");
    expect(text).toMatch(/şüpheyle bakıyor|daha önce hiç duymamıştım|bir etki yaratıyor|tartıyor|kelimelerine dikkat et/i);
  });

  it("gerçek gitme niyeti hâlâ MOVE kategorisini tetikliyor (yanlış-negatif yok)", () => {
    const text = generateGmResponse("oraya gitmek istiyorum");
    expect(text).toMatch(/adım adım|önündeki yol|meşalenin ışığı|sessizce keşfe|adımların yankılanıyor/i);
  });
});
