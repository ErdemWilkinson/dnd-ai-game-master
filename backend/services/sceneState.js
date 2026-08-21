const { scenes } = require("../data/store");
const { createDefaultScene } = require("../data/sceneFactory");

const SESSION_KEY = "default";

function getScene() {
  if (!scenes.has(SESSION_KEY)) {
    scenes.set(SESSION_KEY, createDefaultScene());
  }
  return scenes.get(SESSION_KEY);
}

module.exports = { getScene };
