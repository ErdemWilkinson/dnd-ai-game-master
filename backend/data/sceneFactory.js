const { nanoid } = require("nanoid");

const GRID_WIDTH = 10;
const GRID_HEIGHT = 8;

function createDefaultScene() {
  return {
    id: nanoid(),
    name: "Terk Edilmiş Mahzen",
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    round: 1,
    activeTokenId: "player",
    obstacles: [
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ],
    loot: [
      { id: nanoid(), x: 5, y: 1, name: "Altın Kese" },
      { id: nanoid(), x: 8, y: 6, name: "İksir" },
    ],
    tokens: [
      { id: "player", type: "player", name: "Sen", x: 1, y: 1, speed: 4 },
      { id: "goblin-1", type: "enemy", name: "Goblin", x: 8, y: 2, speed: 3 },
    ],
  };
}

module.exports = { createDefaultScene, GRID_WIDTH, GRID_HEIGHT };
