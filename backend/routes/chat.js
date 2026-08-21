const express = require("express");
const { nanoid } = require("nanoid");
const { chatHistories, characters } = require("../data/store");
const { generateGmResponse } = require("../data/gmFlavor");
const { generateAiNarration, isConfigured } = require("../services/aiGm");
const { allowRequest } = require("../services/rateLimiter");
const { getScene } = require("../services/sceneState");

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

async function generateGmText(playerText, history) {
  if (isConfigured() && allowRequest()) {
    try {
      const text = await generateAiNarration({
        character: getActiveCharacter(),
        scene: getScene(),
        recentMessages: history.slice(-HISTORY_CONTEXT_SIZE),
        playerMessage: playerText,
      });
      return { text, source: "ai" };
    } catch (err) {
      console.error("AI GM çağrısı başarısız, mock'a düşülüyor:", err.message);
    }
  }
  return { text: generateGmResponse(playerText), source: "mock" };
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

  const { text, source } = await generateGmText(playerMessage.text, history);

  const gmMessage = {
    id: nanoid(),
    role: "gm",
    text,
    source,
    timestamp: Date.now(),
  };
  history.push(gmMessage);

  res.status(201).json({ playerMessage, gmMessage });
});

module.exports = router;
