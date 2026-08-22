const express = require("express");
const { nanoid } = require("nanoid");
const { chatHistories, characters, activeCharacterIdBySession } = require("../data/store");
const { getScene } = require("../services/sceneState");
const { resolveAction } = require("../services/actionResolver");
const { generateNarration } = require("../services/narrationService");
const { getSessionId } = require("../services/sessionId");
const { saveChatHistory } = require("../services/persistence");

const router = express.Router();

const HISTORY_CONTEXT_SIZE = 6;

function getHistory(sessionId) {
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, []);
  }
  return chatHistories.get(sessionId);
}

function getActiveCharacter(sessionId) {
  const characterId = activeCharacterIdBySession.get(sessionId);
  if (!characterId) return null;
  return characters.get(characterId) ?? null;
}

router.get("/", (req, res) => {
  res.json({ messages: getHistory(getSessionId(req)) });
});

router.post("/", async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Mesaj gerekli." });
  }

  const sessionId = getSessionId(req);
  const history = getHistory(sessionId);

  const playerMessage = {
    id: nanoid(),
    role: "player",
    text: message.trim(),
    timestamp: Date.now(),
  };
  history.push(playerMessage);

  const character = getActiveCharacter(sessionId);
  const actionResult = resolveAction(character, playerMessage.text);
  const { text, source } = await generateNarration({
    character,
    scene: getScene(sessionId),
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
  saveChatHistory(sessionId, history);

  res.status(201).json({ playerMessage, gmMessage });
});

module.exports = router;
