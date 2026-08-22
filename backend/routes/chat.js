const express = require("express");
const { nanoid } = require("nanoid");
const { chatHistories, characters } = require("../data/store");
const { getScene } = require("../services/sceneState");
const { resolveAction } = require("../services/actionResolver");
const { generateNarration } = require("../services/narrationService");

const router = express.Router();

const SESSION_KEY = "default";
const HISTORY_CONTEXT_SIZE = 6;

function getHistory() {
  if (!chatHistories.has(SESSION_KEY)) {
    chatHistories.set(SESSION_KEY, []);
  }
  return chatHistories.get(SESSION_KEY);
}

function getActiveCharacter() {
  // Faz 1 kapsamıyla tutarlı: en son oluşturulan karakter aktif kabul edilir.
  const all = Array.from(characters.values());
  return all[all.length - 1] ?? null;
}

router.get("/", (_req, res) => {
  res.json({ messages: getHistory() });
});

router.post("/", async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Mesaj gerekli." });
  }

  const history = getHistory();

  const playerMessage = {
    id: nanoid(),
    role: "player",
    text: message.trim(),
    timestamp: Date.now(),
  };
  history.push(playerMessage);

  const actionResult = resolveAction(getActiveCharacter(), playerMessage.text);
  const { text, source } = await generateNarration({
    character: getActiveCharacter(),
    scene: getScene(),
    recentMessages: history.slice(-HISTORY_CONTEXT_SIZE),
    playerMessage: playerMessage.text,
    actionResult,
  });

  const gmMessage = {
    id: nanoid(),
    role: "gm",
    text,
    source,
    roll: actionResult,
    timestamp: Date.now(),
  };
  history.push(gmMessage);

  res.status(201).json({ playerMessage, gmMessage });
});

module.exports = router;
