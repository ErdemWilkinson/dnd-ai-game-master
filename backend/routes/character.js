const express = require("express");
const { nanoid } = require("nanoid");
const { RACES, CLASSES, BASE_ATTRIBUTES, ATTRIBUTE_KEYS } = require("../data/dnd");
const { APPEARANCES } = require("../data/appearances");
const { getSlotForItem, getIconForSlot } = require("../data/itemSlots");
const { characters, chatHistories, activeCharacterIdBySession } = require("../data/store");
const { rollAttributes } = require("../services/dice");
const { generateOpeningStory, isConfigured } = require("../services/aiGm");
const { generateOpeningMock } = require("../data/openingFlavor");
const { allowRequest } = require("../services/rateLimiter");
const { getSessionId } = require("../services/sessionId");
const { saveCharacter, saveChatHistory, saveActiveCharacterId, clearSession } = require("../services/persistence");
const { publicRateLimit } = require("../services/publicRateLimit");
const { trimChatHistory } = require("../services/chatHistoryLimit");
const { resetFreeformEncounter } = require("../services/freeformEncounter");

const router = express.Router();

// Yaratıcı cron fikir #11: isim/mesaj için hiç uzunluk üst sınırı yoktu -
// devasa bir string DB'yi şişirebilir/frontend render sorununa yol açabilir.
const MAX_NAME_LENGTH = 50;

function applyBonuses(base, bonuses) {
  const result = { ...base };
  for (const [attr, value] of Object.entries(bonuses || {})) {
    result[attr] = (result[attr] || 0) + value;
  }
  return result;
}

// Yaratıcı cron fikir #13 (ÖNEMLİ, oyun bütünlüğü açığı): meşru bir değer
// D20 (1-20) + en yüksek ırk bonusu (+2, bkz. data/dnd.js) ile en fazla 22
// olabilir - önceden sadece Number.isFinite kontrolü vardı, üst sınır yoktu
// (client "str: 99" gönderip kabul ettirebiliyordu, prod'da doğrulandı).
const MIN_ATTRIBUTE_VALUE = 1;
const MAX_ATTRIBUTE_VALUE = 22;

function isValidAttributeSet(attributes) {
  if (!attributes || typeof attributes !== "object") return false;
  return ATTRIBUTE_KEYS.every(
    (key) =>
      Number.isInteger(attributes[key]) &&
      attributes[key] >= MIN_ATTRIBUTE_VALUE &&
      attributes[key] <= MAX_ATTRIBUTE_VALUE,
  );
}

router.get("/options", (_req, res) => {
  res.json({
    races: Object.values(RACES),
    classes: Object.values(CLASSES),
    appearances: Object.values(APPEARANCES),
  });
});

router.post("/roll-stats", publicRateLimit, (req, res) => {
  const { raceId } = req.body || {};
  const race = RACES[raceId];
  if (!race) {
    return res.status(400).json({ error: `Geçersiz ırk: ${raceId}` });
  }

  const rolls = rollAttributes();
  const attributes = applyBonuses(rolls, race.attributeBonuses);
  res.json({ rolls, attributes });
});

router.post("/create", publicRateLimit, (req, res) => {
  const { name, raceId, classId, appearanceId, attributes: providedAttributes } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "İsim gerekli." });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `İsim en fazla ${MAX_NAME_LENGTH} karakter olabilir.` });
  }
  const race = RACES[raceId];
  const cls = CLASSES[classId];
  if (!race) {
    return res.status(400).json({ error: `Geçersiz ırk: ${raceId}` });
  }
  if (!cls) {
    return res.status(400).json({ error: `Geçersiz sınıf: ${classId}` });
  }
  const appearance = appearanceId ? APPEARANCES[appearanceId] : null;
  if (appearanceId && !appearance) {
    return res.status(400).json({ error: `Geçersiz dış görünüş: ${appearanceId}` });
  }

  // Zar atma istemciden gelmediyse (örn. doğrudan API testi) sunucu kendi zarını atar.
  const attributes = isValidAttributeSet(providedAttributes)
    ? providedAttributes
    : applyBonuses(rollAttributes(), race.attributeBonuses);

  const id = nanoid();

  const character = {
    id,
    name: name.trim(),
    race: race.id,
    class: cls.id,
    appearance: appearance?.id ?? null,
    level: 1,
    xp: 0,
    hp: { current: cls.baseHp, max: cls.baseHp },
    mana: { current: cls.baseMana, max: cls.baseMana },
    attributes,
    inventory: cls.startingInventory.map((itemName) => {
      const slot = getSlotForItem(itemName);
      return {
        id: nanoid(),
        name: itemName,
        equipped: false,
        slot,
        icon: getIconForSlot(slot),
      };
    }),
  };

  const sessionId = getSessionId(req);
  characters.set(id, character);
  activeCharacterIdBySession.set(sessionId, id);
  saveCharacter(character);
  saveActiveCharacterId(sessionId, id);
  res.status(201).json(character);
});

router.post("/intro", publicRateLimit, async (req, res) => {
  const { characterId } = req.body || {};
  const character = characters.get(characterId);
  if (!character) {
    return res.status(404).json({ error: "Karakter bulunamadı." });
  }
  if (activeCharacterIdBySession.get(getSessionId(req)) !== characterId) {
    return res.status(403).json({ error: "Bu karaktere erişim yetkin yok." });
  }

  const appearanceDescription = character.appearance
    ? APPEARANCES[character.appearance]?.description
    : null;

  let text;
  let source;
  if (isConfigured() && allowRequest()) {
    try {
      text = await generateOpeningStory({ character, appearanceDescription });
      source = "ai";
    } catch (err) {
      console.error("AI açılış hikayesi başarısız, mock'a düşülüyor:", err.message);
    }
  }
  if (!text) {
    text = generateOpeningMock(character);
    source = "mock";
  }

  const sessionId = getSessionId(req);
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, []);
  }
  const history = chatHistories.get(sessionId);
  const introMessage = { id: nanoid(), role: "gm", text, source, timestamp: Date.now() };
  history.push(introMessage);
  trimChatHistory(history);
  saveChatHistory(sessionId, history);

  res.json({ text, source });
});

router.get("/", (req, res) => {
  const characterId = activeCharacterIdBySession.get(getSessionId(req));
  if (!characterId || !characters.has(characterId)) {
    return res.status(404).json({ error: "Aktif karakter yok." });
  }
  res.json(characters.get(characterId));
});

// Yaratıcı cron fikir #29 (ÖNEMLİ, oyun bütünlüğü açığı): eskiden burada bir
// POST "/" route'u vardı, hp/mana/attributes/inventory'yi hiçbir doğrulama
// yapmadan client'tan aynen kabul ediyordu (aynı god-mode açığı fikir #13'ün
// /create'de kapattığı sorunun bir başka endpoint'teki hali - PM prod'da
// str:999 ile doğrudan doğrulamıştı). Frontend'de bu route'u çağıran hiçbir
// kod yoktu (`api.ts`'teki `updateCharacter` export'u tanımlıydı ama hiçbir
// component'ten çağrılmıyordu - ölü kod) - doğrulama eklemek yerine
// kullanılmayan attack surface'ı tamamen kaldırmak tercih edildi.

// Faz 6-C: oyuncu öldükten sonra "yeniden başla" - session'ın karakter/
// sohbet/serbest-form karşılaşma bağını temizler, frontend karakter
// oluşturma ekranına döner.
router.post("/reset", (req, res) => {
  const sessionId = getSessionId(req);
  const characterId = activeCharacterIdBySession.get(sessionId);
  activeCharacterIdBySession.delete(sessionId);
  chatHistories.delete(sessionId);
  resetFreeformEncounter(sessionId);
  clearSession(sessionId, characterId);
  res.json({ ok: true });
});

// Yaratıcı cron fikir #63 (KRİTİK, IDOR açığı): eskiden burada bir
// GET "/:id" route'u vardı, hiçbir sahiplik kontrolü yapmadan `characters`
// Map'inden doğrudan `req.params.id` ile karakter döndürüyordu - herhangi bir
// karakter ID'sini bilen HERKES (başka bir oyuncunun stat/envanter/HP/mana
// verisi dahil) tam karakter datasını okuyabiliyordu (PM prod'da farklı bir
// session'la başka birinin test karakterini okuyarak doğrudan doğrulamıştı).
// Frontend'de bu route'u çağıran hiçbir kod yoktu (`GET /` zaten aktif
// karakteri sessionId üzerinden döndürüyor, yukarıdaki route) - fikir #29'daki
// aynı desen: kullanılmayan attack surface'ı doğrulama eklemek yerine
// tamamen kaldırmak tercih edildi.

module.exports = router;
