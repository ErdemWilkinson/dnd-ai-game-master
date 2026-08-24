// Faz 10: kuşanılan silaha göre hasar zarı. Eşya adına göre eşleme -
// haritada yoksa (bilinmeyen/gelecekte eklenecek silah) güvenli bir
// varsayılan (6) kullanılır. Hiç silah kuşanılmadıysa (silahsız/yumruk)
// çağıran taraf UNARMED_DAMAGE_DIE'ı kullanır.
// Not: eşya adları oyundaki gerçek envanter isimleriyle (data/dnd.js
// startingInventory, data/itemSlots.js) birebir eşleşmeli - "Hançer x2"
// (Hırsız'ın başlangıç silahı) "Hançer" değil, tam adıyla yazılmalı.
const WEAPON_DAMAGE_DIE = {
  "Kısa Kılıç": 6,
  "Hançer x2": 4,
  Topuz: 6,
  Asa: 4,
};

const UNKNOWN_WEAPON_DAMAGE_DIE = 6;
const UNARMED_DAMAGE_DIE = 4;

function getWeaponDamageDie(weaponName) {
  if (!weaponName) return UNARMED_DAMAGE_DIE;
  return WEAPON_DAMAGE_DIE[weaponName] ?? UNKNOWN_WEAPON_DAMAGE_DIE;
}

module.exports = { WEAPON_DAMAGE_DIE, UNKNOWN_WEAPON_DAMAGE_DIE, UNARMED_DAMAGE_DIE, getWeaponDamageDie };
