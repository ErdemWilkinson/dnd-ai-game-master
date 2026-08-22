// Faz 7-A: içerik çeşitliliği - bir karşılaşma temizlenince sıradaki alana geçilir.
// Grid boyutu tüm karşılaşmalarda sabit (GRID_WIDTH x GRID_HEIGHT), oyuncu her
// karşılaşma başında (1,1)'e (spawn) yeniden konumlanır.

const ENCOUNTERS = [
  {
    name: "Terk Edilmiş Mahzen",
    obstacles: [
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ],
    loot: [
      { x: 5, y: 1, name: "Altın Kese" },
      { x: 8, y: 6, name: "İksir" },
    ],
    enemies: [{ id: "goblin-1", name: "Goblin", x: 8, y: 2, speed: 3, hp: 10, maxHp: 10 }],
  },
  {
    name: "Örümcek İni",
    obstacles: [
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 2, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ],
    loot: [
      { x: 1, y: 6, name: "Örümcek İpeği" },
      { x: 7, y: 1, name: "İksir" },
    ],
    enemies: [{ id: "spider-1", name: "Dev Örümcek", x: 8, y: 6, speed: 4, hp: 8, maxHp: 8 }],
  },
  {
    name: "İskelet Mezarlığı",
    obstacles: [
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
      { x: 7, y: 6 },
    ],
    loot: [
      { x: 4, y: 6, name: "Eski Kalkan" },
      { x: 9, y: 1, name: "Altın Kese" },
    ],
    enemies: [
      { id: "skeleton-1", name: "İskelet Savaşçı", x: 8, y: 1, speed: 3, hp: 8, maxHp: 8 },
      { id: "skeleton-2", name: "İskelet Okçu", x: 8, y: 6, speed: 3, hp: 6, maxHp: 6 },
    ],
  },
  {
    name: "Ejderha İni",
    obstacles: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 6, y: 6 },
      { x: 6, y: 7 },
      { x: 4, y: 4 },
    ],
    loot: [{ x: 9, y: 4, name: "Ejderha Pulu" }],
    enemies: [{ id: "dragon-1", name: "Genç Ejderha", x: 8, y: 4, speed: 4, hp: 20, maxHp: 20 }],
  },
];

module.exports = { ENCOUNTERS };
