const express = require("express");
const { nanoid } = require("nanoid");
const { chatHistories, characters, activeCharacterIdBySession } = require("../data/store");
const { getScene } = require("../services/sceneState");
const { resolveAction } = require("../services/actionResolver");
const { generateNarration } = require("../services/narrationService");
const { getSessionId } = require("../services/sessionId");
const { saveChatHistory } = require("../services/persistence");
const { trimChatHistory } = require("../services/chatHistoryLimit");

const router = express.Router();

const HISTORY_CONTEXT_SIZE = 6;
// Yaratıcı cron fikir #11: mesaj için hiç uzunluk üst sınırı yoktu - devasa
// bir string hem DB'yi şişirebilir hem pahalı/başarısız bir AI çağrısına
// yol açabilir.
const MAX_MESSAGE_LENGTH = 500;

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
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.` });
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
  trimChatHistory(history);
  saveChatHistory(sessionId, history);

  res.status(201).json({ playerMessage, gmMessage });
});

module.exports = router;
