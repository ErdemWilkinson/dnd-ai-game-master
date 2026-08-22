import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { ENCOUNTERS } = require("../data/encounters.js");
const { createScene, createDefaultScene, advanceToNextEncounter, GRID_WIDTH, GRID_HEIGHT } = require("../data/sceneFactory.js");

describe("data/encounters.js", () => {
  it("en az 2 farklı karşılaşma tanımlı, her biri isim + en az 1 düşman içerir", () => {
    expect(ENCOUNTERS.length).toBeGreaterThanOrEqual(2);
    for (const encounter of ENCOUNTERS) {
      expect(typeof encounter.name).toBe("string");
      expect(encounter.enemies.length).toBeGreaterThan(0);
    }
  });

  it("her karşılaşmadaki düşman id'leri global olarak benzersiz (route'lar id ile arıyor)", () => {
    const allIds = ENCOUNTERS.flatMap((e) => e.enemies.map((en) => en.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("createScene(encounterIndex)", () => {
  it("encounterIndex 0 ile ilk karşılaşmayı kurar (oyuncu + o karşılaşmanın düşmanları)", () => {
    const scene = createScene(0);
    expect(scene.name).toBe(ENCOUNTERS[0].name);
    expect(scene.encounterIndex).toBe(0);
    expect(scene.totalEncounters).toBe(ENCOUNTERS.length);
    expect(scene.tokens.find((t) => t.id === "player")).toBeTruthy();
    expect(scene.tokens.filter((t) => t.type === "enemy").length).toBe(ENCOUNTERS[0].enemies.length);
  });

  it("her çağrıda oyuncu spawn'a (1,1) yeniden konumlanır, tur/round 1'e sıfırlanır", () => {
    const scene = createScene(1);
    const player = scene.tokens.find((t) => t.id === "player");
    expect(player.x).toBe(1);
    expect(player.y).toBe(1);
    expect(player.actionAvailable).toBe(true);
    expect(player.bonusActionAvailable).toBe(true);
    expect(scene.round).toBe(1);
    expect(scene.activeTokenId).toBe("player");
  });

  it("liste sonuna gelince başa döner (sonsuz zindan) — index === ENCOUNTERS.length ilk karşılaşmayla aynı", () => {
    const wrapped = createScene(ENCOUNTERS.length);
    const first = createScene(0);
    expect(wrapped.name).toBe(first.name);
    expect(wrapped.encounterIndex).toBe(ENCOUNTERS.length); // index kendisi sarmıyor, sadece hangi ENCOUNTERS öğesinin seçildiği sarıyor
  });

  it("grid boyutu tüm karşılaşmalarda sabit (GRID_WIDTH x GRID_HEIGHT)", () => {
    for (let i = 0; i < ENCOUNTERS.length; i++) {
      const scene = createScene(i);
      expect(scene.width).toBe(GRID_WIDTH);
      expect(scene.height).toBe(GRID_HEIGHT);
    }
  });

  it("createDefaultScene() createScene(0) ile aynı karşılaşmayı kurar (geriye dönük uyumluluk)", () => {
    const scene = createDefaultScene();
    expect(scene.name).toBe(ENCOUNTERS[0].name);
    expect(scene.encounterIndex).toBe(0);
  });
});

describe("advanceToNextEncounter(scene)", () => {
  it("sahneyi REFERANSLA mutasyona uğratır (aynı obje referansı döner)", () => {
    const scene = createScene(0);
    const result = advanceToNextEncounter(scene);
    expect(result).toBe(scene); // aynı referans
  });

  it("encounterIndex'i bir arttırır ve sıradaki karşılaşmanın verisini yükler", () => {
    const scene = createScene(0);
    advanceToNextEncounter(scene);
    expect(scene.encounterIndex).toBe(1);
    expect(scene.name).toBe(ENCOUNTERS[1].name);
    expect(scene.tokens.filter((t) => t.type === "enemy").length).toBe(ENCOUNTERS[1].enemies.length);
  });

  it("sahnenin id'sini DEĞİŞTİRMEZ (route'ların elinde tuttuğu sahne referansı aynı sahne olarak kalmalı)", () => {
    const scene = createScene(0);
    const originalId = scene.id;
    advanceToNextEncounter(scene);
    expect(scene.id).toBe(originalId);
  });

  it("oyuncu yeni karşılaşmada spawn'a döner, tur/aksiyon sıfırlanır", () => {
    const scene = createScene(0);
    const player = scene.tokens.find((t) => t.id === "player");
    player.x = 7;
    player.y = 5;
    player.actionAvailable = false;
    player.bonusActionAvailable = false;
    player.movementLeft = 0;

    advanceToNextEncounter(scene);

    const newPlayer = scene.tokens.find((t) => t.id === "player");
    expect(newPlayer.x).toBe(1);
    expect(newPlayer.y).toBe(1);
    expect(newPlayer.actionAvailable).toBe(true);
    expect(newPlayer.bonusActionAvailable).toBe(true);
    expect(scene.round).toBe(1);
    expect(scene.activeTokenId).toBe("player");
  });

  it("son karşılaşmadan sonra tekrar çağrılınca başa döner (sonsuz zindan)", () => {
    let scene = createScene(ENCOUNTERS.length - 1);
    advanceToNextEncounter(scene);
    expect(scene.encounterIndex).toBe(ENCOUNTERS.length);
    expect(scene.name).toBe(ENCOUNTERS[0].name); // % ENCOUNTERS.length ile başa sarıyor
  });
});
