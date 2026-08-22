// Faz 4: tamamen scriptli/deterministik dusman AI'i - ek AI/LLM cagrisi yok.
// Dusman token'in sirasi geldiginde oyuncuya dogru hareket eder, bitisikse
// mevcut zar mantigiyla (D20 + sabit modifier) basit bir saldiri dener.

const { rollD20, rollDie } = require("./dice");
const { isBlocked } = require("./sceneState");
const { DIFFICULTY_CLASS } = require("./actionResolver");

const ENEMY_ATTACK_MODIFIER = 2;
const ENEMY_DAMAGE_DIE = 6;

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
    return stepsMoved > 0 ? `${enemy.name} sana doğru yaklaşıyor.` : `${enemy.name} olduğu yerde bekliyor.`;
  }

  if (!enemy.actionAvailable || !character) {
    return `${enemy.name} yanına geldi ama saldırma fırsatı bulamadı.`;
  }

  const roll = rollD20();
  const total = roll + ENEMY_ATTACK_MODIFIER;
  enemy.actionAvailable = false;

  if (roll === 1 || total < DIFFICULTY_CLASS) {
    return `${enemy.name} sana saldırıyor ama ıskalıyor! (${roll}+${ENEMY_ATTACK_MODIFIER}=${total} vs ${DIFFICULTY_CLASS})`;
  }

  const damage = rollDie(ENEMY_DAMAGE_DIE) + (roll === 20 ? ENEMY_DAMAGE_DIE : 0);
  character.hp.current = Math.max(0, character.hp.current - damage);

  return `${enemy.name} sana vuruyor! ${damage} hasar aldın. (${roll}+${ENEMY_ATTACK_MODIFIER}=${total} vs ${DIFFICULTY_CLASS}, HP: ${character.hp.current}/${character.hp.max})`;
}

module.exports = { runEnemyTurn, moveEnemyToward };
