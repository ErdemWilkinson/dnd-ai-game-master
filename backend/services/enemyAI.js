// Faz 4: tamamen scriptli/deterministik dusman AI'i - ek AI/LLM cagrisi yok.
// Dusman token'in sirasi geldiginde oyuncuya dogru hareket eder, bitisikse
// mevcut zar mantigiyla (D20 + sabit modifier) basit bir saldiri dener.

const { rollD20, rollDie } = require("./dice");
const { isBlocked } = require("./sceneState");
const { DIFFICULTY_CLASS } = require("./actionResolver");
const { getTotalArmorReduction } = require("../data/armorReduction");

const ENEMY_ATTACK_MODIFIER = 2;
const ENEMY_DAMAGE_DIE = 6;

// Faz 8: kullanıcı geri bildirimi - savaş mesajlarında ham zar matematiği
// ("18+2=20 vs 12") görünmemeli, sadece betimleyici anlatım. Zar backend'de
// hâlâ hesaplanıyor (yukarıdaki değişkenler), sadece kullanıcıya gösterilen
// metne artık karışmıyor. Çeşitlilik için birden fazla şablon arasından
// rastgele seçiliyor.
function pick(templates) {
  return templates[Math.floor(Math.random() * templates.length)];
}

function approachMessage(enemyName) {
  return pick([
    `${enemyName} sana doğru yaklaşıyor.`,
    `${enemyName} adımlarını sana doğru hızlandırıyor.`,
    `${enemyName} seni fark edip üzerine yürüyor.`,
  ]);
}

function idleMessage(enemyName) {
  return pick([
    `${enemyName} olduğu yerde bekliyor.`,
    `${enemyName} tetikte, kıpırdamadan seni izliyor.`,
  ]);
}

function noAttackMessage(enemyName) {
  return pick([
    `${enemyName} yanına geldi ama saldırma fırsatı bulamadı.`,
    `${enemyName} tam saldıracakken tereddüt ediyor.`,
  ]);
}

function missMessage(enemyName) {
  return pick([
    `${enemyName} sana saldırıyor ama ıskalıyor!`,
    `${enemyName} bir darbe indiriyor, ama boşa gidiyor.`,
    `Son anda kenara kayınca ${enemyName}'in saldırısı seni bulamıyor.`,
  ]);
}

function hitMessage(enemyName, damage, currentHp, maxHp) {
  const template = pick([
    `${enemyName} sana vuruyor! ${damage} hasar aldın.`,
    `${enemyName}'in darbesi seni sarsıyor, ${damage} hasar aldın.`,
    `${enemyName} tam isabet ettiriyor! ${damage} hasar aldın.`,
  ]);
  return `${template} (HP: ${currentHp}/${maxHp})`;
}

// Tek adimda x veya y ekseninde oyuncuya bir kare yaklasmaya calisir, o
// eksen engelliyse diger ekseni dener. Tam pathfinding degil, basit/greedy.
function moveEnemyToward(scene, enemy, target) {
  let steps = 0;

  while (steps < enemy.movementLeft) {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    if (Math.abs(dx) + Math.abs(dy) <= 1) break;

    const preferX = Math.abs(dx) >= Math.abs(dy);
    let moved = false;

    if (preferX && dx !== 0) {
      const nx = enemy.x + Math.sign(dx);
      if (!isBlocked(scene, nx, enemy.y, enemy.id)) {
        enemy.x = nx;
        moved = true;
      }
    } else if (!preferX && dy !== 0) {
      const ny = enemy.y + Math.sign(dy);
      if (!isBlocked(scene, enemy.x, ny, enemy.id)) {
        enemy.y = ny;
        moved = true;
      }
    }

    if (!moved && dy !== 0) {
      const ny = enemy.y + Math.sign(dy);
      if (!isBlocked(scene, enemy.x, ny, enemy.id)) {
        enemy.y = ny;
        moved = true;
      }
    }
    if (!moved && dx !== 0) {
      const nx = enemy.x + Math.sign(dx);
      if (!isBlocked(scene, nx, enemy.y, enemy.id)) {
        enemy.x = nx;
        moved = true;
      }
    }

    if (!moved) break;
    steps += 1;
  }

  enemy.movementLeft -= steps;
  return steps;
}

function runEnemyTurn(scene, enemy, character) {
  const playerToken = scene.tokens.find((t) => t.id === "player");
  if (!playerToken) return null;

  const stepsMoved = moveEnemyToward(scene, enemy, playerToken);

  const dx = playerToken.x - enemy.x;
  const dy = playerToken.y - enemy.y;
  const adjacent = Math.abs(dx) + Math.abs(dy) === 1;

  if (!adjacent) {
    return stepsMoved > 0 ? approachMessage(enemy.name) : idleMessage(enemy.name);
  }

  if (!enemy.actionAvailable || !character) {
    return noAttackMessage(enemy.name);
  }

  const roll = rollD20();
  const total = roll + ENEMY_ATTACK_MODIFIER;
  enemy.actionAvailable = false;

  if (roll === 1 || total < DIFFICULTY_CLASS) {
    return missMessage(enemy.name);
  }

  const rawDamage = rollDie(ENEMY_DAMAGE_DIE) + (roll === 20 ? ENEMY_DAMAGE_DIE : 0);
  const armorReduction = getTotalArmorReduction(character);
  const damage = Math.max(0, rawDamage - armorReduction);
  character.hp.current = Math.max(0, character.hp.current - damage);

  return hitMessage(enemy.name, damage, character.hp.current, character.hp.max);
}

module.exports = { runEnemyTurn, moveEnemyToward };
