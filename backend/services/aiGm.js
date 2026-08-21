const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.6-flash";

let cachedClient = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(apiKey);
  }
  return cachedClient;
}

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function callGemini(prompt) {
  const client = getClient();
  if (!client) {
    throw new Error("GEMINI_API_KEY tanımlı değil.");
  }

  const model = client.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) {
    throw new Error("Gemini boş cevap döndürdü.");
  }
  return text;
}

const ATTRIBUTE_LABELS_TR = {
  str: "Güç",
  dex: "Çeviklik",
  con: "Dayanıklılık",
  int: "Zeka",
  wis: "Bilgelik",
  cha: "Karizma",
};

function describeActionResult(actionResult) {
  if (!actionResult) return "";
  const { attribute, roll, modifier, total, dc, outcome } = actionResult;
  const outcomeText =
    {
      "critical-success": "BÜYÜK BAŞARI (doğal 20)",
      success: "BAŞARILI",
      failure: "BAŞARISIZ",
      "critical-failure": "BÜYÜK BAŞARISIZLIK (doğal 1)",
    }[outcome] ?? outcome;

  return `\nEylem çözümlemesi (sistem tarafından zaten atıldı, sen sadece SONUCA göre anlat, kendi zarını uydurma):
${ATTRIBUTE_LABELS_TR[attribute] ?? attribute} kontrolü — zar: ${roll} + bonus: ${modifier} = ${total} (zorluk: ${dc}) → ${outcomeText}`;
}

function buildPrompt({ character, scene, recentMessages, playerMessage, actionResult }) {
  const historyText = recentMessages
    .map((m) => `${m.role === "player" ? "Oyuncu" : "GM"}: ${m.text}`)
    .join("\n");

  return `Sen bir D&D 5e Game Master'sın. Türkçe, atmosferik, 3-5 cümlelik bir anlatım yap.
Oyunun kural/durum yönetimi (HP, envanter, konum) senin dışında bir sistem tarafından yapılıyor —
sadece SAHNEYİ ANLAT, sayısal bir durum değişikliği iddia etme veya kendi zar sonucunu uydurma.
Anlatımında mümkün olduğunca 5 duyuya (görme, işitme, koku, dokunma, tat) dokun — sürekli atmosferik ve detaylı ol.

Karakter: ${character?.name ?? "Bilinmiyor"} (${character?.race ?? "?"} / ${character?.class ?? "?"}), HP ${character?.hp?.current ?? "?"}/${character?.hp?.max ?? "?"}
Sahne: ${scene?.name ?? "Bilinmiyor"}
${describeActionResult(actionResult)}

Son konuşma:
${historyText || "(henüz konuşma yok)"}

Oyuncu: ${playerMessage}

GM anlatımı:`;
}

async function generateAiNarration({ character, scene, recentMessages, playerMessage, actionResult }) {
  const prompt = buildPrompt({ character, scene, recentMessages, playerMessage, actionResult });
  return callGemini(prompt);
}

function buildOpeningPrompt({ character, appearanceDescription }) {
  return `Sen bir D&D 5e Game Master'sın. Türkçe, atmosferik, 3-5 cümlelik bir AÇILIŞ SAHNESİ yaz.
Bu, oyuncunun macerasının ilk anı — karakterin nerede/nasıl bir durumda gözlerini açtığını anlat.
Sadece anlat, oyun durumu (HP, envanter) hakkında sayısal bir iddia yapma.

Karakter: ${character?.name ?? "Bilinmiyor"}, ${character?.race ?? "?"} ${character?.class ?? "?"}
Dış görünüş: ${appearanceDescription ?? "belirtilmemiş"}

Açılış sahnesi:`;
}

async function generateOpeningStory({ character, appearanceDescription }) {
  const prompt = buildOpeningPrompt({ character, appearanceDescription });
  return callGemini(prompt);
}

module.exports = { generateAiNarration, generateOpeningStory, isConfigured, MODEL_NAME };
