const { nanoid } = require("nanoid");
const { ENCOUNTERS } = require("./encounters");

const GRID_WIDTH = 10;
const GRID_HEIGHT = 8;
const PLAYER_SPAWN = { x: 1, y: 1 };

function buildEnemyToken(enemy) {
  return {
    id: enemy.id,
    type: "enemy",
    name: enemy.name,
    x: enemy.x,
    y: enemy.y,
    speed: enemy.speed,
    movementLeft: enemy.speed,
    actionAvailable: true,
    bonusActionAvailable: true,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
  };
}

function buildPlayerToken() {
  return {
    id: "player",
    type: "player",
    name: "Sen",
    x: PLAYER_SPAWN.x,
    y: PLAYER_SPAWN.y,
    speed: 5,
    movementLeft: 5,
    actionAvailable: true,
    bonusActionAvailable: true,
  };
}

// Faz 7-A: encounterIndex, ENCOUNTERS listesinde hangi karşılaşmanın
// yükleneceğini belirler (liste sonuna gelince başa döner - sonsuz zindan).
function createScene(encounterIndex = 0) {
  const encounter = ENCOUNTERS[encounterIndex % ENCOUNTERS.length];
  return {
    id: nanoid(),
    name: encounter.name,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    round: 1,
    activeTokenId: "player",
    encounterIndex,
    totalEncounters: ENCOUNTERS.length,
    // Faz 11 (PM kararı): karşılaşma temizlenince bir sonraki karşılaşmanın
    // düşmanları HEMEN sahneye girmiyor - oyuncu bir sonraki hareketinde
    // (routes/scene.js: resolvePendingEncounter) "yürüyerek giriyor". `null`
    // = bekleyen bir geçiş yok.
    pendingEncounterIndex: null,
    obstacles: encounter.obstacles.map((o) => ({ ...o })),
    loot: encounter.loot.map((l) => ({ id: nanoid(), ...l })),
    tokens: [buildPlayerToken(), ...encounter.enemies.map(buildEnemyToken)],
  };
}

// Sahneyi bir sonraki karşılaşmaya geçirir - mevcut sahne nesnesini REFERANSLA
// mutasyona uğratır (route'ların zaten yakaladığı `scene` değişkeni geçerli kalsın diye).
function advanceToNextEncounter(scene) {
  const next = createScene(scene.encounterIndex + 1);
  scene.name = next.name;
  scene.round = next.round;
  scene.activeTokenId = next.activeTokenId;
  scene.encounterIndex = next.encounterIndex;
  scene.totalEncounters = next.totalEncounters;
  scene.obstacles = next.obstacles;
  scene.loot = next.loot;
  scene.tokens = next.tokens;
  return scene;
}

// Geriye dönük uyumluluk (Faz 1'den beri): tek argümansız çağrı ilk karşılaşmayı kurar.
function createDefaultScene() {
  return createScene(0);
}

module.exports = { createScene, createDefaultScene, advanceToNextEncounter, GRID_WIDTH, GRID_HEIGHT };
