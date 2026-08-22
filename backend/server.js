require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { loadAll } = require("./services/persistence");
const characterRouter = require("./routes/character");
const chatRouter = require("./routes/chat");
const sceneRouter = require("./routes/scene");

const app = express();
const PORT = process.env.PORT || 3001;

loadAll();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/character", characterRouter);
app.use("/api/chat", chatRouter);
app.use("/api/scene", sceneRouter);

app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

module.exports = app;
