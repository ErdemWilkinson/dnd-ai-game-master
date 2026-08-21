// Basit bellek-içi state store (Faz 1 - kalıcılık yok).

const characters = new Map();
const chatHistories = new Map();
const scenes = new Map();

module.exports = { characters, chatHistories, scenes };
