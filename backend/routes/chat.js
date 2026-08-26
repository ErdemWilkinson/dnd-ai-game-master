const express = require("express");
const { nanoid } = require("nanoid");
const { chatHistories, characters, activeCharacterIdBySession } = require("../data/store");
const { getScene } = require("../services/sceneState");
const { resolveAction } = require("../services/actionResolver");
const { resolveFreeformAction } = require("../services/freeformCombat");
const { generateNarration } = require("../services/narrationService");
const { getSessionId } = require("../services/sessionId");
const { saveChatHistory, saveCharacter } = require("../services/persistence");
const { trimChatHistory } = require("../services/chatHistoryLimit");
const { publicRateLimit } = require("../services/publicRateLimit");

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

// Faz 12-A: serbest metinden algılanan GERÇEK mekanik sonucu (saldırı/eşya)
// okunabilir bir Türkçe ek metne çevirir - grid'in `routes/scene.js`'teki
// aynı narrationText'e ek yapma deseniyle (bkz. /attack, /move) tutarlı.
function describeFreeformResult(result, character) {
  if (!result) return "";

  if (result.kind === "attack") {
    let suffix = "";
    if (result.damage > 0) {
      suffix += ` ${result.target.name}'e ${result.damage} hasar verdin.`;
    }
    if (result.defeated) {
      suffix += ` ${result.target.name} yenildi!`;
    }
    if (result.levelsGained > 0) {
      suffix += ` ${character.name} seviye ${character.level}'e ulaştı!`;
    }
    if (result.encounterCleared) {
      // Fikir #87: grid'in `checkEncounterCleared()`'ındaki aynı "tüm havuzu
      // bir kere turladın" özel anı - serbest-form yolunda eksikti.
      suffix += result.completedFullLap
        ? ` Tüm bölgeyi temizledin! Kahramanlığın efsaneleşiyor... ama tehlike hiç bitmiyor, yeni bir tehdit beliriyor: ${result.nextEncounterName}.`
        : ` Alanı temizledin! Yeni alan: ${result.nextEncounterName}.`;
    }
    return suffix;
  }

  if (result.kind === "cast") {
    if (result.spell.id === "heal") {
      return result.healed > 0
        ? ` ${result.spell.name} büyüsünü kendine uyguladın, ${result.healed} HP iyileştirdin.`
        : ` ${result.spell.name} büyüsünü kendine uyguladın.`;
    }
    let suffix = "";
    const defeatedHits = result.blastHits.filter((h) => h.defeated);
    if (result.blastHits.length > 1) {
      suffix += ` ${result.spell.name} ${result.blastHits.length} düşmana çarptı, ${defeatedHits.length} tanesi yenildi!`;
    } else if (result.blastHits.length === 1) {
      const hit = result.blastHits[0];
      suffix += ` ${hit.name}'e ${result.spell.name} ile ${hit.damage} hasar verdin.`;
      if (hit.defeated) suffix += ` ${hit.name} yenildi!`;
    }
    if (result.levelsGained > 0) {
      suffix += ` ${character.name} seviye ${character.level}'e ulaştı!`;
    }
    if (result.encounterCleared) {
      suffix += result.completedFullLap
        ? ` Tüm bölgeyi temizledin! Kahramanlığın efsaneleşiyor... ama tehlike hiç bitmiyor, yeni bir tehdit beliriyor: ${result.nextEncounterName}.`
        : ` Alanı temizledin! Yeni alan: ${result.nextEncounterName}.`;
    }
    return suffix;
  }

  if (result.kind === "consume") {
    return result.healed > 0
      ? ` ${result.item.name} kullanıldı, ${result.healed} HP iyileştirdin.`
      : ` ${result.item.name} kullanıldı.`;
  }

  if (result.kind === "pickup") {
    if (result.inventoryFull) return " Envanterin dolu, eşyayı alamadın.";
    return ` ${result.item.name} envanterine eklendi!`;
  }

  return "";
}

router.get("/", (req, res) => {
  res.json({ messages: getHistory(getSessionId(req)) });
});

// Yaratıcı cron fikir #36: hiç IP bazlı hız sınırı yoktu - her chat isteği
// bir AI çağrısı DENEYİP render.yaml'daki PAYLAŞILAN/global AI_HOURLY_LIMIT
// bütçesini tüketiyordu. Fikir #2'de `/character/create`+`/roll-stats`'a
// eklenen aynı `publicRateLimit` deseni burada da uygulanıyor - tek bir
// hızlı script artık saatlik AI bütçesini saniyeler içinde bitirip HERKESİ
// o saat boyunca mock'a düşüremiyor.
router.post("/", publicRateLimit, async (req, res) => {
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
  // Faz 12-A/12-C-hazırlık: saldırı/saldırı büyüsü niyeti algılanıp GERÇEK bir
  // mekanik sonuç üretilirse (aktif düşman varsa), anlatım için o gerçek D20
  // sonucunu kullan - aksi halde (eşya/roleplay/iyileştirme büyüsü/düşmansız
  // saldırı denemesi) eskisi gibi sadece anlatım rengi için `resolveAction()`'ın
  // metinden tahmin ettiği zar. İyileştirme büyüsünün (`kind:"cast"` ama
  // `spell.id==="heal"`) hiç D20'si yok (grid'in `/cast` heal dalıyla aynı),
  // bu yüzden `actionResult` alanı sadece saldırı büyüsünde dolu.
  const freeformResult = resolveFreeformAction(character, sessionId, playerMessage.text);
  const actionResult = freeformResult?.actionResult ?? resolveAction(character, playerMessage.text);
  const { text, source } = await generateNarration({
    character,
    scene: getScene(sessionId),
    recentMessages: history.slice(-HISTORY_CONTEXT_SIZE),
    playerMessage: playerMessage.text,
    actionResult,
  });

  const narrationText = text + describeFreeformResult(freeformResult, character);
  if (freeformResult) {
    saveCharacter(character);
  }

  const gmMessage = {
    id: nanoid(),
    role: "gm",
    text: narrationText,
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
