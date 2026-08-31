const express = require("express");
const { nanoid } = require("nanoid");
const { chatHistories, characters, activeCharacterIdBySession } = require("../data/store");
const { getFreeformEncounter } = require("../services/freeformEncounter");
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
// Faz 12-C-hazırlık 2 (PM onaylı): oyuncunun saldırı/saldırı büyüsünden SONRA,
// hâlâ canlı düşman varsa tek bir düşmanın karşılık verdiğini anlatıya ekler -
// karakter ölürse (hp<=0) frontend zaten GameOverScreen'i gösteriyor (yanıttaki
// güncel `character` üzerinden), burada ekstra bir şey yapmaya gerek yok.
function describeEnemyRetaliation(retaliation, character) {
  if (!retaliation) return "";
  if (!retaliation.hit) return ` ${retaliation.enemyName} karşılık vermeye çalışıyor ama ıskalıyor.`;
  const hpText = ` (HP: ${character.hp.current}/${character.hp.max})`;
  return character.hp.current <= 0
    ? ` ${retaliation.enemyName} karşılık veriyor, ${retaliation.damage} hasar alıyorsun ve yere yığılıyorsun!${hpText}`
    : ` ${retaliation.enemyName} karşılık veriyor, ${retaliation.damage} hasar alıyorsun.${hpText}`;
}

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
    suffix += describeEnemyRetaliation(result.enemyRetaliation, character);
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
    suffix += describeEnemyRetaliation(result.enemyRetaliation, character);
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

  if (result.kind === "equip") {
    return result.equipped ? ` ${result.item.name} kuşandın.` : ` ${result.item.name} çıkardın.`;
  }

  if (result.kind === "drop") {
    return ` ${result.item.name} eşyasını yere bıraktın.`;
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

  // Yaratıcı cron fikir #92: Faz 12-C ile grid kalkınca `requireOwnedCharacter()`
  // gibi bir sahiplik/durum kontrolü hiçbir yerde kalmadı - ölü bir karakter
  // (hp<=0) chat üzerinden saldırıp XP kazanabiliyor, hatta İyileştir ile
  // sessizce "dirilebiliyordu" (frontend'in GameOverScreen'i sadece görsel bir
  // kapıydı, backend'de hiç zorlanmıyordu). AI çağrısına/mekanik çözümlemeye
  // hiç girmeden en başta kesiliyor - hem güvenlik hem gereksiz AI bütçesi
  // israfını önlemek için.
  if (character && character.hp.current <= 0) {
    const gmMessage = {
      id: nanoid(),
      role: "gm",
      text: "Karakterin can çekişiyor, artık hareket edemiyor... Yeni bir maceraya başlamalısın.",
      source: "mock",
      roll: null,
      timestamp: Date.now(),
    };
    history.push(gmMessage);
    trimChatHistory(history);
    saveChatHistory(sessionId, history);
    return res.status(201).json({ playerMessage, gmMessage, character });
  }

  const freeformResult = resolveFreeformAction(character, sessionId, playerMessage.text);
  // Tester QA'sının bulduğu ek not (Faz 12-C-hazırlık sonrası, TASKS.md'de):
  // eskiden GERÇEK bir mekanik sonuç (heal cast/eşya kullan/eşya al)
  // D20 içermediğinde `resolveAction()`'ın metinden tahmin ettiği ALAKASIZ bir
  // flavor-zarına düşülüyordu - garanti-başarılı bir İyileştir cast'inde bile
  // yanlışlıkla "Başarısız" rozeti görünebiliyordu. Artık üç durum ayrı ayrı
  // ele alınıyor: (1) freeformResult'ın kendi D20'si varsa (saldırı/saldırı
  // büyüsü) onu kullan; (2) GERÇEK bir mekanik sonuç var ama D20'süz (heal
  // cast, eşya kullan/al) - hiç roll badge'i gösterme (`null`); (3) hiçbir
  // mekanik sonuç yoksa (saf roleplay/düşmansız saldırı denemesi) eskisi gibi
  // sadece anlatım rengi için `resolveAction()`'ın tahmini zarı.
  let actionResult;
  if (freeformResult?.actionResult) {
    actionResult = freeformResult.actionResult;
  } else if (freeformResult) {
    actionResult = null;
  } else {
    actionResult = resolveAction(character, playerMessage.text);
  }
  const { text, source } = await generateNarration({
    character,
    scene: getFreeformEncounter(sessionId),
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

  // Tester QA'sının bulduğu KRİTİK bug (Faz 12-C-hazırlık sonrası, TASKS.md'de
  // repro'lu): yanıt eskiden güncel `character`'ı hiç içermiyordu - Faz 12-B
  // ile chat varsayılan/tek arayüz olduktan sonra saldırı/büyü/eşya kullanımı
  // sunucuda HP/Mana/XP/Level/envanteri GERÇEKTEN değiştiriyordu ama frontend
  // bunu görecek hiçbir yola sahip değildi (grid'e dokunmadıkça ya da sayfa
  // yenilenmedikçe). `character` her zaman (freeform mutasyon olsun olmasın)
  // dahil ediliyor - `null` da olabilir (aktif karakter yoksa), frontend zaten
  // `Character | null` bekleyecek şekilde güncellendi.
  res.status(201).json({ playerMessage, gmMessage, character });
});

module.exports = router;
