import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "module";
import express from "express";
import request from "supertest";

// bkz. chat.test.js: require() ile aynı CJS module cache'ini kullanmak
// gerekiyor, aksi halde store.js/freeformEncounter.js singleton'ları testte
// ayrı bir kopya olarak yüklenir ve clear()/reset() gerçek router state'ini
// etkilemez.
const require = createRequire(import.meta.url);
const chatRouter = require("../routes/chat.js");
const characterRouter = require("../routes/character.js");
const { chatHistories, characters, activeCharacterIdBySession } = require("../data/store.js");
const { DEFAULT_SESSION_ID } = require("../services/sessionId.js");
const { getFreeformEncounter, advanceFreeformEncounter, resetFreeformEncounter } = require("../services/freeformEncounter.js");
const { ENCOUNTERS } = require("../data/encounters.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRouter);
  app.use("/api/character", characterRouter);
  return app;
}

async function createFighter(app) {
  const res = await request(app)
    .post("/api/character/create")
    .send({ name: "Kahraman", raceId: "human", classId: "fighter" });
  return res.body;
}

async function createWizard(app) {
  const res = await request(app)
    .post("/api/character/create")
    .send({ name: "Büyücü", raceId: "human", classId: "wizard" });
  return res.body;
}

describe("Faz 12-A: /chat serbest metinden GERÇEK mekanik sonuç (saldırı/eşya)", () => {
  beforeEach(() => {
    chatHistories.clear();
    characters.clear();
    activeCharacterIdBySession.clear();
    resetFreeformEncounter(DEFAULT_SESSION_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saldırı niyeti algılanınca aktif düşmana GERÇEKTEN hasar uygular (HP gerçekten düşer)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // yüksek isabet ihtimali (D20 -> 19)
    const app = buildApp();
    await createFighter(app);

    const before = getFreeformEncounter(DEFAULT_SESSION_ID);
    const goblinBefore = before.enemies.find((e) => e.id === "goblin-1");
    expect(goblinBefore).toBeTruthy();
    const hpBefore = goblinBefore.hp;

    const res = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.roll).toMatchObject({ attribute: "str", dc: 12 }); // fighter primary: str

    const after = getFreeformEncounter(DEFAULT_SESSION_ID);
    const goblinAfter = after.enemies.find((e) => e.id === "goblin-1");
    expect(goblinAfter.hp).toBeLessThan(hpBefore);
    expect(res.body.gmMessage.text).toMatch(/hasar verdin/);

    // Tester QA'sının bulduğu kritik bug: /chat yanıtı güncel character'ı
    // hiç içermiyordu - saldırı Aksiyon puanı tüketmez ama yine de karakter
    // objesinin yanıtta gerçekten döndüğünü doğruluyoruz (frontend senkronu).
    expect(res.body.character).toBeTruthy();
    expect(res.body.character.id).toBe((await request(app).get("/api/character")).body.id);

    // Faz 12-C-hazırlık 2 (PM onaylı): goblin yenilmedi (hâlâ 6 HP), bu yüzden
    // KARŞILIK VERMELİ - oyuncu GERÇEKTEN hasar almalı (eskiden freeform'da
    // hiçbir düşman karşılığı yoktu, oyuncu asla hasar almıyordu).
    expect(res.body.character.hp.current).toBeLessThan(12); // fighter başlangıç HP: 12
    expect(res.body.gmMessage.text).toMatch(/karşılık veriyor/);
  });

  it("düşman yenilince karakter gerçekten XP kazanır ve karşılaşma bir sonrakine geçer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // maksimum isabet + hasar, kritikler dahil
    const app = buildApp();
    const character = await createFighter(app);
    expect(character.xp).toBe(0);
    // Fikir #92: düşman karşılığı artık GERÇEK hasar veriyor (Faz 12-C-hazırlık
    // 2), sabit maksimum-hasar mock'uyla (0.99) her karşılık da kritik vuruyor
    // - oyuncu goblin'i bitirmeden ölebilir (ki bu artık doğru bir davranış).
    // Bu testin amacı XP/karşılaşma geçişi olduğundan, oyuncuyu ölmeyecek
    // kadar yüksek HP'ye getiriyoruz.
    characters.get(character.id).hp.current = 9999;
    characters.get(character.id).hp.max = 9999;

    let cleared = false;
    // Goblin'in HP'sini (10) sıfıra indirmek için gerektiği kadar saldır -
    // tam hasar sayısını sabitlemek yerine (silah/kritik matematiğine bağlı,
    // kırılgan) döngüyle gerçekten yenilene kadar deniyoruz.
    let lastRes;
    for (let i = 0; i < 10 && !cleared; i++) {
      lastRes = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
      if (lastRes.body.gmMessage.text.includes("yenildi")) cleared = true;
    }

    expect(cleared).toBe(true);
    expect(lastRes.body.gmMessage.text).toMatch(/Alanı temizledin! Yeni alan:/);

    const updatedCharacter = characters.get(character.id);
    // XP_PER_KILL=20, xpToNextLevel(1)=50 - tek bir kill ile seviye atlamaz,
    // ama xp alanı gerçekten 0'dan 20'ye güncellenmiş olmalı.
    expect(updatedCharacter.xp).toBe(20);

    const state = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(state.encounterIndex).toBe(1); // bir sonraki karşılaşmaya geçti
    expect(state.enemies.length).toBeGreaterThan(0); // yeni karşılaşmanın düşmanları yüklendi
  });

  it("İnovasyon fikri: birden fazla düşman varken var olmayan/yanlış isimli bir düşmana saldırı denenince (fikir #93'ün resolveEquip'te düzelttiği AYNI bug sınıfı) sessizce başka bir düşmana saldırılmaz", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = buildApp();
    await createFighter(app);

    // İskelet Mezarlığı (index 2): iki düşman - İskelet Savaşçı + İskelet Okçu.
    advanceFreeformEncounter(DEFAULT_SESSION_ID);
    advanceFreeformEncounter(DEFAULT_SESSION_ID);
    const before = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(before.enemies.length).toBe(2);
    const hpSnapshot = before.enemies.map((e) => ({ id: e.id, hp: e.hp }));

    // "Ejderha" bu karşılaşmada yok - eskiden isim eşleşmeyince sessizce
    // ilk düşmana (İskelet Savaşçı) düşülüyordu.
    const res = await request(app).post("/api/chat").send({ message: "Ejderha'ya saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/hasar verdin/);

    const after = getFreeformEncounter(DEFAULT_SESSION_ID);
    for (const enemy of after.enemies) {
      const before = hpSnapshot.find((e) => e.id === enemy.id);
      expect(enemy.hp).toBe(before.hp); // hiçbir düşman hasar almadı
    }
  });

  it("İnovasyon fikri #87: tüm karşılaşma havuzu bir kez turlanınca özel bir 'Tüm bölgeyi temizledin' anı yaşatır (grid'in checkEncounterCleared()'ıyla aynı davranış)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const app = buildApp();
    const character = await createFighter(app);
    // Fikir #92: düşman karşılığı artık GERÇEK hasar veriyor (Faz 12-C-hazırlık
    // 2) - sabit maksimum-hasar mock'uyla (0.99) oyuncu, tüm havuzu bitirmeden
    // ÖLEBİLİR (ki bu artık doğru/istenen bir davranış). Bu testin amacı ölüm
    // mekaniği değil "tam tur" mesajı olduğundan, oyuncuyu bilinçli olarak
    // ölmeyecek kadar yüksek HP'ye getiriyoruz.
    characters.get(character.id).hp.current = 9999;
    characters.get(character.id).hp.max = 9999;

    // Havuzdaki SON karşılaşmaya kadar ilerlet (index ENCOUNTERS.length-1) -
    // bu karşılaşma temizlenince (index+1) % length === 0 olacak.
    for (let i = 0; i < ENCOUNTERS.length - 1; i++) {
      advanceFreeformEncounter(DEFAULT_SESSION_ID);
    }
    expect(getFreeformEncounter(DEFAULT_SESSION_ID).encounterIndex).toBe(ENCOUNTERS.length - 1);

    let lastRes;
    let cleared = false;
    for (let i = 0; i < 10 && !cleared; i++) {
      lastRes = await request(app).post("/api/chat").send({ message: "Düşmana saldırıyorum" });
      if (lastRes.body.gmMessage.text.includes("yenildi")) cleared = true;
    }

    expect(cleared).toBe(true);
    expect(lastRes.body.gmMessage.text).toMatch(/Tüm bölgeyi temizledin!/);
    // Normal ("Alanı temizledin! Yeni alan:") mesajı DEĞİL, özel tam-tur mesajı gösterilmeli.
    expect(lastRes.body.gmMessage.text).not.toContain("Alanı temizledin! Yeni alan:");

    const stateAfter = getFreeformEncounter(DEFAULT_SESSION_ID);
    // encounterIndex sonsuza kadar artan bir sayaç (grid'in sceneFactory.js'iyle
    // aynı desen) - içerik seçimi (name/enemies) % ENCOUNTERS.length ile
    // sarılıyor, ama alanın kendisi sarılmıyor.
    expect(stateAfter.encounterIndex).toBe(ENCOUNTERS.length);
    expect(stateAfter.name).toBe(ENCOUNTERS[0].name); // içerik başa sardı
  });

  it("Faz 12-C-hazırlık: İyileştir büyüsü algılanınca mana GERÇEKTEN düşer ve HP GERÇEKTEN iyileşir", async () => {
    const app = buildApp();
    const character = await createWizard(app);
    expect(character.mana.current).toBe(character.mana.max); // wizard mana.max=12

    const stored = characters.get(character.id);
    stored.hp.current = Math.max(1, stored.hp.max - 5);
    const hpBefore = stored.hp.current;

    const res = await request(app).post("/api/chat").send({ message: "Kendime İyileştir büyüsünü uyguluyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.hp.current).toBeGreaterThan(hpBefore);
    expect(updated.mana.current).toBe(character.mana.max - 4); // heal manaCost=4
    expect(res.body.gmMessage.text).toMatch(/İyileştir büyüsünü kendine uyguladın.*HP iyileştirdin/);

    // Tester QA'sının bulduğu kritik bug: yanıt eskiden güncel character'ı
    // hiç içermiyordu - frontend'in HP/Mana'yı sayfa yenilemeden görebilmesi
    // için artık her zaman dahil ediliyor.
    expect(res.body.character.hp.current).toBe(updated.hp.current);
    expect(res.body.character.mana.current).toBe(updated.mana.current);

    // Tester QA'sının bulduğu ek not: rolsüz (D20'siz) bir cast (heal) artık
    // ALAKASIZ bir flavor-zarı ("Başarılı"/"Başarısız" rozeti) göstermiyor.
    expect(res.body.gmMessage.roll).toBeNull();
  });

  it("Faz 12-C-hazırlık: Ateş Topu büyüsü algılanınca aktif düşmana GERÇEKTEN hasar uygular, mana düşer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = buildApp();
    const character = await createWizard(app);

    const before = getFreeformEncounter(DEFAULT_SESSION_ID);
    const hpBefore = before.enemies.find((e) => e.id === "goblin-1").hp;

    const res = await request(app).post("/api/chat").send({ message: "Ateş Topu'nu fırlatıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.roll).toMatchObject({ attribute: "int", dc: 12 }); // wizard primary: int

    const after = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(after.enemies.find((e) => e.id === "goblin-1").hp).toBeLessThan(hpBefore);
    const updatedCharacter = characters.get(character.id);
    expect(updatedCharacter.mana.current).toBe(character.mana.max - 4); // fireball manaCost=4
    expect(res.body.gmMessage.text).toMatch(/hasar verdin/);

    // Faz 12-C-hazırlık 2: goblin hâlâ hayatta (10 HP'den 8 hasar aldı), saldırı
    // büyüsünden sonra da karşılık vermeli.
    expect(res.body.character.hp.current).toBeLessThan(character.hp.max);
    expect(res.body.gmMessage.text).toMatch(/karşılık veriyor/);
  });

  it("Faz 12-C-hazırlık 2: son düşman öldürülünce O ANKİ mesajda KARŞILIK VERMEZ (kimse kalmadı)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // maksimum isabet + hasar, kritikler dahil
    const app = buildApp();
    const character = await createFighter(app);
    // Fikir #92: bkz. yukarıdaki testteki aynı not - sabit maksimum-hasar
    // mock'uyla düşman karşılığı da her zaman kritik vurur, oyuncu goblin'i
    // bitirmeden ölebilir. Bu testin amacı "son düşman ölünce karşılık
    // vermiyor" olduğundan, oyuncuyu ölmeyecek kadar yüksek HP'ye getiriyoruz.
    characters.get(character.id).hp.current = 9999;
    characters.get(character.id).hp.max = 9999;

    let lastRes;
    let cleared = false;
    for (let i = 0; i < 10 && !cleared; i++) {
      lastRes = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
      if (lastRes.body.gmMessage.text.includes("yenildi")) cleared = true;
    }

    expect(cleared).toBe(true);
    // Öldürücü darbeyi indiren mesajda geride karşılık verecek kimse kalmadığından
    // oyuncu O MESAJDA hasar almamalı (önceki mesajlarda almış olabilir, HP'nin
    // sıfırdan büyük olması yeterli - asıl kanıt "karşılık veriyor" metninin
    // öldürücü darbe mesajında hiç geçmemesi).
    expect(lastRes.body.gmMessage.text).not.toMatch(/karşılık veriyor|karşılık vermeye çalışıyor/);
  });

  it("Faz 12-C-hazırlık 2: düşman karşılığı ISKALAYABİLİR (düşük zar), oyuncu hasar almaz ama mesaj yine de gösterilir", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // D20 -> 1 (nat 1, kesin ıska) hem oyuncu hem düşman için
    const app = buildApp();
    const character = await createFighter(app);

    const res = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(res.status).toBe(201);

    expect(res.body.character.hp.current).toBe(character.hp.max); // hasar almadı
    expect(res.body.gmMessage.text).toMatch(/karşılık vermeye çalışıyor ama ıskalıyor/);
  });

  it("Faz 12-C-hazırlık 2: karşılık vuruşu HP'yi sıfıra indirirse yanıttaki character bunu yansıtır (GameOverScreen'in tetiklenebilmesi için)", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const stored = characters.get(character.id);
    stored.hp.current = 1; // bir sonraki isabetli vuruşta ölecek şekilde ayarla

    // r=0.5: oyuncunun kendi saldırısı isabetli ama öldürücü değil (goblin
    // hayatta kalır) - ardından goblin'in karşılığı da isabet edip (d6 min
    // hasar bile 1 HP'lik karakteri öldürmeye yeter) oyuncuyu öldürür.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const res = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(res.status).toBe(201);

    expect(res.body.gmMessage.text).toMatch(/yere yığılıyorsun/);
    // App.tsx zaten character.hp.current<=0 olunca GameOverScreen'i gösteriyor -
    // burada yanıtın bunu GERÇEKTEN yansıttığını (0'ın altına değil, 0'da
    // clamp'lendiğini) doğruluyoruz.
    expect(res.body.character.hp.current).toBe(0);
  });

  it("Faz 12-C-hazırlık: Ateş Topu, karşılaşmadaki TÜM canlı düşmanlara isabet eder (grid'in bitişik-hücre AoE'sinin freeform karşılığı)", async () => {
    const app = buildApp();
    const character = await createWizard(app);

    // İskelet Mezarlığı (index 2) - 2 düşmanlı tek karşılaşma, AoE'yi test etmek için ideal.
    advanceFreeformEncounter(DEFAULT_SESSION_ID);
    advanceFreeformEncounter(DEFAULT_SESSION_ID);
    const before = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(before.enemies.length).toBe(2);
    // `getFreeformEncounter` her zaman AYNI canlı state referansını döndürüyor
    // (snapshot değil) - saldırıdan ÖNCEKİ HP'leri id'ye göre ayrı bir Map'te
    // saklıyoruz, aksi halde "before"/"after" aynı (mutasyona uğramış) diziyi
    // gösterir.
    const hpBeforeById = new Map(before.enemies.map((e) => [e.id, e.hp]));

    // Tek bir sabit Math.random değeri hem D20'yi hem hasar zarını (d8)
    // AYNI ANDA belirlediğinden "garantili isabet + düşük hasar" (iki
    // düşmanın da HAYATTA kalıp gerçek bir HP azalması gözlemlenmesi) için
    // int modifier'ı doğrudan store üzerinden yükseltip zayıf bir zarla
    // (0.3 -> d20:7, d8:3) bile isabeti garantiliyoruz.
    characters.get(character.id).attributes.int = 20; // modifier +5
    vi.spyOn(Math, "random").mockReturnValue(0.3); // total 7+5=12 >= DC12 -> success (tam sınırda), hasar 3 (öldürmeye yetmez)

    const res = await request(app).post("/api/chat").send({ message: "Ateş Topu'nu fırlatıyorum" });
    expect(res.status).toBe(201);

    const after = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(after.enemies.length).toBe(2); // ikisi de hayatta kaldı, HP karşılaştırması yapılabilir
    for (const enemy of after.enemies) {
      expect(enemy.hp).toBeLessThan(hpBeforeById.get(enemy.id));
    }
    expect(res.body.gmMessage.text).toMatch(/düşmana çarptı/);
  });

  it("Faz 12-C-hazırlık: mana yetersizse büyü niyeti sessizce hiçbir mekanik sonuç üretmez (eski davranış korunur)", async () => {
    const app = buildApp();
    const character = await createWizard(app);
    const stored = characters.get(character.id);
    stored.mana.current = 1; // fireball/heal ikisi de 4 mana gerektiriyor

    const res = await request(app).post("/api/chat").send({ message: "Ateş Topu'nu fırlatıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/hasar verdin|yenildi/);
    expect(characters.get(character.id).mana.current).toBe(1); // mana harcanmadı
  });

  it("Faz 12-C-hazırlık: mana kullanamayan sınıf (fighter) büyü adı geçse bile hiçbir mekanik sonuç tetiklemez", async () => {
    const app = buildApp();
    await createFighter(app);

    const res = await request(app).post("/api/chat").send({ message: "Ateş Topu'nu fırlatıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/hasar verdin|yenildi/);
  });

  it("eşya kullanma niyeti algılanınca envanterdeki iksir GERÇEKTEN tüketilip HP iyileştiriyor", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const potion = character.inventory.find((i) => i.name.includes("İksir"));
    expect(potion).toBeTruthy();

    // Önce hasar alsın ki iyileşme gözlemlenebilsin.
    const stored = characters.get(character.id);
    stored.hp.current = Math.max(1, stored.hp.max - 5);
    const hpBefore = stored.hp.current;

    const res = await request(app).post("/api/chat").send({ message: "İksiri içiyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.hp.current).toBeGreaterThan(hpBefore);
    expect(updated.inventory.find((i) => i.id === potion.id)).toBeUndefined();
    expect(res.body.gmMessage.text).toMatch(/kullanıldı.*HP iyileştirdin/);

    // Tester QA'sının bulduğu iki bulgu: yanıt güncel character'ı içeriyor
    // (envanterden eşyanın gerçekten kalktığı yanıtta da görünüyor) VE
    // rolsüz bu eşya-kullan aksiyonu ALAKASIZ bir flavor-zarı göstermiyor.
    expect(res.body.character.inventory.find((i) => i.id === potion.id)).toBeUndefined();
    expect(res.body.gmMessage.roll).toBeNull();
  });

  it("Faz 12-C-hazırlık 2: kuşanma niyeti algılanınca eşya GERÇEKTEN kuşanılıyor (paper-doll mantığı ile)", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const sword = character.inventory.find((i) => i.name === "Kısa Kılıç");
    expect(sword).toBeTruthy();
    expect(sword.equipped).toBe(false);

    const res = await request(app).post("/api/chat").send({ message: "Kısa Kılıcı kuşanıyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.inventory.find((i) => i.id === sword.id).equipped).toBe(true);
    expect(res.body.character.inventory.find((i) => i.id === sword.id).equipped).toBe(true);
    expect(res.body.gmMessage.roll).toBeNull(); // rolsüz aksiyon, alakasız zar yok
    expect(res.body.gmMessage.text).toMatch(/Kısa Kılıç kuşandın/);
  });

  it("Faz 12-C-hazırlık 2: aynı slotta başka bir eşya kuşanılıysa önce o çıkarılır (paper-doll)", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const stored = characters.get(character.id);
    const sword = stored.inventory.find((i) => i.name === "Kısa Kılıç");
    sword.equipped = true; // önce kılıç kuşanılmış gibi simüle et
    stored.inventory.push({ id: "test-dagger", name: "İkinci Silah", equipped: false, slot: "hand", icon: null });

    const res = await request(app).post("/api/chat").send({ message: "İkinci Silahı kuşanıyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.inventory.find((i) => i.id === "test-dagger").equipped).toBe(true);
    expect(updated.inventory.find((i) => i.name === "Kısa Kılıç").equipped).toBe(false); // eski silah çıkarıldı
  });

  it("Faz 12-C-hazırlık 2: kuşanılabilir eşyası yoksa (ya da kuşanma niyeti yanlış algılanmışsa) sessizce hiçbir mekanik sonuç üretmez", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const stored = characters.get(character.id);
    stored.inventory = stored.inventory.filter((i) => !i.slot); // tüm kuşanılabilir eşyaları çıkar

    const res = await request(app).post("/api/chat").send({ message: "Kılıcı kuşanıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/kuşandın/);
  });

  it("İnovasyon fikri #93: SAHİP OLUNMAYAN bir eşya istenince artık İLK kuşanılabilir eşyaya sessizce düşülmüyor (eskiden kuşanılı silahı yanlışlıkla çıkarabiliyordu)", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const stored = characters.get(character.id);
    const sword = stored.inventory.find((i) => i.name === "Kısa Kılıç");
    sword.equipped = true; // kılıç zaten kuşanılı

    // Karakterin envanterinde hiç miğfer yok - eskiden bu, isim eşleşmeyince
    // İLK kuşanılabilir eşyaya (kılıç) düşüp onu YANLIŞLIKLA çıkarıyordu.
    const res = await request(app).post("/api/chat").send({ message: "Miğferimi takıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/kuşandın|çıkardın/);

    const updated = characters.get(character.id);
    expect(updated.inventory.find((i) => i.name === "Kısa Kılıç").equipped).toBe(true); // hâlâ kuşanılı, çıkarılmadı
  });

  it("İnovasyon fikri #93: Türkçe ünsüz yumuşamasıyla çekimlenen eşya adları (Kılıç→Kılıcı) hâlâ doğru eşleşiyor", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const sword = character.inventory.find((i) => i.name === "Kısa Kılıç");
    expect(sword.equipped).toBe(false);

    const res = await request(app).post("/api/chat").send({ message: "Kısa Kılıcı kuşanıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).toMatch(/Kısa Kılıç kuşandın/);

    const updated = characters.get(character.id);
    expect(updated.inventory.find((i) => i.id === sword.id).equipped).toBe(true);
  });

  it("İnovasyon fikri #97: çok kelimeli bir eşya adının SADECE son kelimesiyle (iyelik ekiyle) kısaltılmış doğal referanslar da kuşanma/bırakmada eşleşiyor", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const sword = character.inventory.find((i) => i.name === "Kısa Kılıç");
    expect(sword.equipped).toBe(false);

    // "Kısa" hiç geçmiyor - eskiden nameMatchesText sadece TAM adı arıyordu,
    // bu yüzden sessizce eşleşme kurulamıyordu.
    const equipRes = await request(app).post("/api/chat").send({ message: "Kılıcımı kuşanıyorum" });
    expect(equipRes.status).toBe(201);
    expect(equipRes.body.gmMessage.text).toMatch(/Kısa Kılıç kuşandın/);
    expect(characters.get(character.id).inventory.find((i) => i.id === sword.id).equipped).toBe(true);

    const dropRes = await request(app).post("/api/chat").send({ message: "Kılıcımı bırakıyorum" });
    expect(dropRes.status).toBe(201);
    expect(dropRes.body.gmMessage.text).toMatch(/Kısa Kılıç eşyasını yere bıraktın/);
    expect(characters.get(character.id).inventory.find((i) => i.id === sword.id)).toBeUndefined();
  });

  it("eşya alma niyeti algılanınca sahnedeki loot GERÇEKTEN envantere ekleniyor", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const inventoryCountBefore = character.inventory.length;

    const stateBefore = getFreeformEncounter(DEFAULT_SESSION_ID);
    const lootCountBefore = stateBefore.loot.length;
    expect(lootCountBefore).toBeGreaterThan(0);

    const res = await request(app).post("/api/chat").send({ message: "Yerdeki eşyayı alıyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.inventory.length).toBe(inventoryCountBefore + 1);
    const stateAfter = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(stateAfter.loot.length).toBe(lootCountBefore - 1);
    expect(res.body.gmMessage.text).toMatch(/envanterine eklendi/);
  });

  it("İnovasyon fikri #96: eşya bırakma niyeti algılanınca envanterdeki eşya GERÇEKTEN çıkarılıp sahnenin loot havuzuna ekleniyor", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const sword = character.inventory.find((i) => i.name === "Kısa Kılıç");
    expect(sword).toBeTruthy();
    const inventoryCountBefore = character.inventory.length;

    const stateBefore = getFreeformEncounter(DEFAULT_SESSION_ID);
    const lootCountBefore = stateBefore.loot.length;

    const res = await request(app).post("/api/chat").send({ message: "Kısa Kılıcı bırakıyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.inventory.find((i) => i.id === sword.id)).toBeUndefined();
    expect(updated.inventory.length).toBe(inventoryCountBefore - 1);

    const stateAfter = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(stateAfter.loot.length).toBe(lootCountBefore + 1);
    expect(stateAfter.loot.some((l) => l.name === "Kısa Kılıç")).toBe(true);
    expect(res.body.gmMessage.text).toMatch(/Kısa Kılıç eşyasını yere bıraktın/);
    expect(res.body.gmMessage.roll).toBeNull();
    expect(res.body.character.inventory.find((i) => i.id === sword.id)).toBeUndefined();
  });

  it("İnovasyon fikri #96: bırakılan eşya sonradan tekrar 'alıyorum' ile envantere geri alınabilir (kayıp değil geçici yer değişikliği)", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const sword = character.inventory.find((i) => i.name === "Kısa Kılıç");

    await request(app).post("/api/chat").send({ message: "Kısa Kılıcı bırakıyorum" });
    // Bırakılan eşya loot dizisinin SONUNA eklenir - önce sahnedeki orijinal
    // loot'u tüketip sıraya girmesini bekliyoruz.
    const state = getFreeformEncounter(DEFAULT_SESSION_ID);
    state.loot = state.loot.filter((l) => l.name === "Kısa Kılıç"); // sadece bıraktığımız kalsın

    const res = await request(app).post("/api/chat").send({ message: "Yerdeki eşyayı alıyorum" });
    expect(res.status).toBe(201);

    const updated = characters.get(character.id);
    expect(updated.inventory.some((i) => i.name === "Kısa Kılıç" && i.id !== sword.id)).toBe(true);
  });

  it("İnovasyon fikri #96: sahip olunmayan bir eşya bırakılmak istenince (isim eşleşmezse) sessizce başka bir eşya bırakılmaz", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const inventoryCountBefore = character.inventory.length;

    const res = await request(app).post("/api/chat").send({ message: "Miğferimi bırakıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/yere bıraktın/);

    const updated = characters.get(character.id);
    expect(updated.inventory.length).toBe(inventoryCountBefore);
  });

  it("İnovasyon fikri #96: envanter boşken bırakma niyeti sessizce hiçbir mekanik sonuç üretmez", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const stored = characters.get(character.id);
    stored.inventory = [];

    const res = await request(app).post("/api/chat").send({ message: "Kılıcı bırakıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/yere bıraktın/);
  });

  it("İnovasyon fikri #96: envanter MAX_INVENTORY'e ulaştığında bırakma ile boşaltılıp yeni eşya tekrar alınabilir hale gelir", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const stored = characters.get(character.id);
    // 30'a tamamla (mevcut başlangıç eşyalarının üzerine dolgu eşya ekle).
    while (stored.inventory.length < 30) {
      stored.inventory.push({ id: `filler-${stored.inventory.length}`, name: `Dolgu Eşya ${stored.inventory.length}`, equipped: false, slot: null, icon: null });
    }
    expect(stored.inventory.length).toBe(30);

    const fullRes = await request(app).post("/api/chat").send({ message: "Yerdeki eşyayı alıyorum" });
    expect(fullRes.body.gmMessage.text).toMatch(/Envanterin dolu/);

    const fillerName = stored.inventory.find((i) => i.id.startsWith("filler-")).name;
    const dropRes = await request(app).post("/api/chat").send({ message: `${fillerName}'ı bırakıyorum` });
    expect(dropRes.status).toBe(201);
    expect(dropRes.body.gmMessage.text).toMatch(/yere bıraktın/);
    expect(characters.get(character.id).inventory.length).toBe(29);

    const retryRes = await request(app).post("/api/chat").send({ message: "Yerdeki eşyayı alıyorum" });
    expect(retryRes.body.gmMessage.text).toMatch(/envanterine eklendi/);
    expect(characters.get(character.id).inventory.length).toBe(30);
  });

  it("aktif karakter yoksa saldırı/eşya niyeti tespit edilse bile hiçbir mekanik sonuç üretmez (eski davranış korunur)", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/hasar verdin|yenildi/);
    expect(res.body.character).toBeNull(); // aktif karakter yok, yanıt bunu doğru yansıtıyor
  });

  it("/character/reset serbest-form düşman/loot state'ini de sıfırlar (bir sonraki karakter baştan Terk Edilmiş Mahzen ile başlar)", async () => {
    const app = buildApp();
    await createFighter(app);
    const state = getFreeformEncounter(DEFAULT_SESSION_ID);
    state.encounterIndex = 3; // ilerlemiş gibi simüle et

    await request(app).post("/api/character/reset");

    const freshState = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(freshState.encounterIndex).toBe(0);
    expect(freshState.name).toBe("Terk Edilmiş Mahzen");
  });

  it("düşman yokken (karşılaşma temizlendikten sonra) saldırı niyeti sessizce hiçbir mekanik sonuç üretmez", async () => {
    const app = buildApp();
    await createFighter(app);
    const state = getFreeformEncounter(DEFAULT_SESSION_ID);
    state.enemies = []; // tüm düşmanlar zaten temizlenmiş gibi simüle et

    const res = await request(app).post("/api/chat").send({ message: "Boşluğa saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).not.toMatch(/hasar verdin|yenildi/);
  });

  it("İnovasyon fikri #92: ölü bir karakter (hp<=0) chat üzerinden HİÇBİR mekanik aksiyon gerçekleştiremez (saldırı/büyü/eşya/kuşanma dahil)", async () => {
    const app = buildApp();
    const character = await createFighter(app);
    const stored = characters.get(character.id);
    stored.hp.current = 0; // karakter "öldü"
    const xpBefore = stored.xp;
    const inventoryBefore = stored.inventory.length;

    const res = await request(app).post("/api/chat").send({ message: "Goblin'e saldırıyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).toMatch(/Yeni bir maceraya başlamalısın/);
    expect(res.body.gmMessage.roll).toBeNull();

    const after = characters.get(character.id);
    expect(after.xp).toBe(xpBefore); // XP kazanmadı
    expect(after.inventory.length).toBe(inventoryBefore); // envanter değişmedi
    expect(after.hp.current).toBe(0); // "dirilmedi"

    const freeformState = getFreeformEncounter(DEFAULT_SESSION_ID);
    expect(freeformState.enemies.find((e) => e.id === "goblin-1").hp).toBe(10); // düşmana hiç hasar verilmedi
  });

  it("İnovasyon fikri #92: ölü bir karakter İyileştir büyüsüyle bile 'dirilemez' (mana yeterli olsa dahi)", async () => {
    const app = buildApp();
    const character = await createWizard(app);
    const stored = characters.get(character.id);
    stored.hp.current = 0;
    const manaBefore = stored.mana.current;

    const res = await request(app).post("/api/chat").send({ message: "Kendime İyileştir büyüsünü uyguluyorum" });
    expect(res.status).toBe(201);
    expect(res.body.gmMessage.text).toMatch(/Yeni bir maceraya başlamalısın/);

    const after = characters.get(character.id);
    expect(after.hp.current).toBe(0); // hâlâ ölü
    expect(after.mana.current).toBe(manaBefore); // mana harcanmadı
  });

});
