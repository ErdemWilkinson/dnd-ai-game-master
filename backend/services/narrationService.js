const { generateAiNarration, isConfigured } = require("./aiGm");
const { generateGmResponse } = require("../data/gmFlavor");
const { allowRequest } = require("./rateLimiter");

const MOCK_OUTCOME_SUFFIX = {
  "critical-success": " Üstelik beklediğinden çok daha iyi gitti!",
  success: "",
  failure: " Ama bu seferki girişimin başarısız oldu.",
  "critical-failure": " Ve işler olabileceğin en kötü şekilde ters gitti.",
};

// AI dene -> hata/limit/key yok -> sessizce mock'a düş (Faz 2 ilkesi).
// chat.js ve routes/scene.js (saldırı, hareket anlatımı) arasında paylaşılır.
async function generateNarration({ character, scene, recentMessages = [], playerMessage, actionResult }) {
  if (isConfigured() && allowRequest()) {
    try {
      const text = await generateAiNarration({ character, scene, recentMessages, playerMessage, actionResult });
      return { text, source: "ai" };
    } catch (err) {
      console.error("AI GM çağrısı başarısız, mock'a düşülüyor:", err.message);
    }
  }
  const suffix = actionResult ? MOCK_OUTCOME_SUFFIX[actionResult.outcome] ?? "" : "";
  return { text: generateGmResponse(playerMessage) + suffix, source: "mock" };
}

module.exports = { generateNarration, MOCK_OUTCOME_SUFFIX };
