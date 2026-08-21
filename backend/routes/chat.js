const express = require("express");
const { nanoid } = require("nanoid");
const { chatHistories } = require("../data/store");
const { generateGmResponse } = require("../data/gmFlavor");

const router = express.Router();

const SESSION_KEY = "default";

function getHistory() {
  if (!chatHistories.has(SESSION_KEY)) {
    chatHistories.set(SESSION_KEY, []);
  }
  return chatHistories.get(SESSION_KEY);
}

router.get("/", (_req, res) => {
  res.json({ messages: getHistory() });
});

router.post("/", (req, res) => {
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

  const gmMessage = {
    id: nanoid(),
    role: "gm",
    text: generateGmResponse(message),
    timestamp: Date.now(),
  };
  history.push(gmMessage);

  res.status(201).json({ playerMessage, gmMessage });
});

module.exports = router;
