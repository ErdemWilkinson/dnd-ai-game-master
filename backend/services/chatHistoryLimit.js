// Yaratıcı cron fikir #6: chat history hiç sınırlandırılmıyordu - uzun bir
// oturumda sınırsız büyüyüp her yazmayı O(n) yapıyordu. AI'a giden bağlam
// zaten history.slice(-6) ile sınırlı (chat.js/scene.js) - bu sadece
// depolanan diziyi makul bir üst sınırla kırpıyor, prompt bağlamını etkilemez.
const MAX_CHAT_HISTORY = 200;

// history dizisini REFERANSLA (splice ile) kırpar - çağıranların elindeki
// referans aynı kalır, chat.js/scene.js/character.js'teki mevcut
// "push sonra saveChatHistory" deseniyle uyumlu.
function trimChatHistory(history) {
  if (history.length > MAX_CHAT_HISTORY) {
    history.splice(0, history.length - MAX_CHAT_HISTORY);
  }
}

module.exports = { trimChatHistory, MAX_CHAT_HISTORY };
