// Basit bellek-içi state store.
// Faz 6-A: chatHistories artık sessionId'ye göre anahtarlanıyor (bkz.
// services/sessionId.js). characters hâlâ characterId'ye göre global tutuluyor
// (id'ler zaten benzersiz), hangi karakterin "aktif" olduğu session başına
// activeCharacterIdBySession ile takip ediliyor.

const characters = new Map();
const chatHistories = new Map();
const activeCharacterIdBySession = new Map();

module.exports = { characters, chatHistories, activeCharacterIdBySession };
