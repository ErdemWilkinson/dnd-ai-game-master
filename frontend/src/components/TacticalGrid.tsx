import { useEffect, useRef, useState } from 'react';
import { attackTarget, castSpell, endTurn, getScene, moveToken, throwItem } from '../api';
import type { Character, Scene, SpellId } from '../types';

interface Props {
  characterId: string;
  throwingItemId?: string | null;
  castingSpellId?: SpellId | null;
  onThrowComplete?: (character: Character) => void;
  onCastComplete?: (character: Character) => void;
  onTurnResolved?: (enemyMessages: string[]) => void;
  onCharacterChange?: (character: Character) => void;
  onChatActivity?: () => void;
  // Faz 11: App'in "savaş modu" (grid görünür/gizli) kararını verebilmesi
  // için - ekstra bir "savaş modu" state'i TUTMUYORUZ, App bu callback'ten
  // gelen sahneden `scene.tokens.some(t => t.type === 'enemy')` ile türetiyor.
  onSceneUpdate?: (scene: Scene) => void;
  refreshKey?: number;
}

export function TacticalGrid({
  characterId,
  throwingItemId = null,
  castingSpellId = null,
  onThrowComplete,
  onCastComplete,
  onTurnResolved,
  onCharacterChange,
  onChatActivity,
  onSceneUpdate,
  refreshKey = 0,
}: Props) {
  const [scene, setSceneState] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Faz 11 polish: saldırı isabet edince hedefin bulunduğu karede kısa bir
  // "sallanma/flaş" + üzerinde beliren bir hasar sayısı göstermek için. Hedef
  // ölürse token sahneden kalkıyor ama koordinatı burada yakaladığımız için
  // popup yine de doğru karede beliriyor.
  const [damageFx, setDamageFx] = useState<{ x: number; y: number; damage: number; key: number } | null>(null);

  // Faz 11 polish: token'lar anlık "zıplamak" yerine kareler arası kayarak
  // hareket etsin diye - her hücrenin gerçek piksel konumunu ölçüp bir
  // overlay katmanındaki token işaretçilerini bu konumlara `left`/`top`
  // transition'ıyla yerleştiriyoruz. Yüzde bazlı bir hesap `gap`/`padding`
  // yüzünden hücre sınırlarıyla tam örtüşmeyeceğinden gerçek ölçüm kullanıldı.
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellRects, setCellRects] = useState<Map<string, { left: number; top: number; width: number; height: number }>>(
    new Map(),
  );

  function setScene(updated: Scene) {
    setSceneState(updated);
    onSceneUpdate?.(updated);
  }

  useEffect(() => {
    getScene().then(setScene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;

    function measure() {
      const containerRect = gridEl!.getBoundingClientRect();
      const next = new Map<string, { left: number; top: number; width: number; height: number }>();
      gridEl!.querySelectorAll<HTMLButtonElement>('.cell').forEach((cellEl) => {
        const { x, y } = cellEl.dataset;
        if (x == null || y == null) return;
        const rect = cellEl.getBoundingClientRect();
        next.set(`${x},${y}`, {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        });
      });
      setCellRects(next);
    }

    measure();
    // jsdom (test ortamı) ResizeObserver sağlamıyor - overlay konumlandırması
    // sadece gerçek bir tarayıcıda gerekli, testlerde ilk ölçüm yeterli.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [scene?.width, scene?.height]);

  async function handleThrowTarget(x: number, y: number) {
    if (!throwingItemId) return;
    setError(null);
    try {
      const { character, scene: updated } = await throwItem(characterId, throwingItemId, x, y);
      setScene(updated);
      onThrowComplete?.(character);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCastTarget(targetTokenId: string) {
    if (!castingSpellId) return;
    setError(null);
    try {
      const { character, scene: updated } = await castSpell(characterId, castingSpellId, targetTokenId);
      if (updated) setScene(updated);
      onCastComplete?.(character);
      onChatActivity?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleMoveTarget(x: number, y: number) {
    if (!scene) return;
    const activeToken = scene.tokens.find((t) => t.id === scene.activeTokenId);
    if (activeToken?.type !== 'player') {
      setError('Sıra sende değil.');
      return;
    }
    setError(null);
    try {
      const { scene: updated, narration, character } = await moveToken(scene.activeTokenId, x, y);
      setScene(updated);
      if (character) onCharacterChange?.(character);
      if (narration) onChatActivity?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAttack(targetTokenId: string) {
    setError(null);
    const target = scene?.tokens.find((t) => t.id === targetTokenId);
    try {
      const { character, scene: updated, damage } = await attackTarget(characterId, targetTokenId);
      setScene(updated);
      if (target && damage > 0) triggerDamageFx(target.x, target.y, damage);
      onCharacterChange?.(character);
      onChatActivity?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function triggerDamageFx(x: number, y: number, damage: number) {
    const key = Date.now();
    setDamageFx({ x, y, damage, key });
    window.setTimeout(() => {
      setDamageFx((current) => (current?.key === key ? null : current));
    }, 700);
  }

  function handleCellClick(x: number, y: number) {
    if (throwingItemId) {
      handleThrowTarget(x, y);
      return;
    }
    const key = `${x},${y}`;
    const token = scene?.tokens.find((t) => `${t.x},${t.y}` === key);
    if (castingSpellId) {
      if (token?.type === 'enemy') {
        handleCastTarget(token.id);
      }
      // Büyü hedef-seç modundayken düşman olmayan bir hücreye tıklamak
      // no-op olmalı - yanlışlıkla hareket ettirmemeli.
      return;
    }
    if (token?.type === 'enemy') {
      handleAttack(token.id);
      return;
    }
    handleMoveTarget(x, y);
  }

  async function handleEndTurn() {
    const { enemyMessages, ...updated } = await endTurn();
    setScene(updated);
    onTurnResolved?.(enemyMessages);
  }

  if (!scene) return <div className="tactical-grid">Harita yükleniyor...</div>;

  const obstacleSet = new Set(scene.obstacles.map((o) => `${o.x},${o.y}`));
  const lootMap = new Map(scene.loot.map((l) => [`${l.x},${l.y}`, l]));
  const tokenMap = new Map(scene.tokens.map((t) => [`${t.x},${t.y}`, t]));

  const rows = Array.from({ length: scene.height }, (_, y) => y);
  const cols = Array.from({ length: scene.width }, (_, x) => x);
  const activeToken = scene.tokens.find((t) => t.id === scene.activeTokenId);
  const isPlayerTurn = activeToken?.type === 'player';
  const specialMode = Boolean(throwingItemId || castingSpellId);
  const gridInteractive = specialMode ? true : isPlayerTurn;
  const playerToken = scene.tokens.find((t) => t.id === 'player');

  return (
    <div className="tactical-grid">
      <div className="scene-header">
        <h3>{scene.name}</h3>
        <span className="encounter-progress">
          Karşılaşma: {scene.encounterIndex + 1}/{scene.totalEncounters}
        </span>
        <span>
          {throwingItemId
            ? 'Fırlatma hedefi seç'
            : castingSpellId
              ? 'Büyü hedefi seç'
              : `Tur ${scene.round} · Sıra: ${activeToken?.name}${!isPlayerTurn ? ' (senin sıran değil)' : ''}`}
        </span>
        {playerToken && (
          <span className="movement-economy">
            Hareket: {playerToken.movementLeft}/{playerToken.speed}
          </span>
        )}
        {playerToken && (
          <span className="action-economy">
            Aksiyon: {playerToken.actionAvailable ? '✓' : '✗'} · Bonus: {playerToken.bonusActionAvailable ? '✓' : '✗'}
          </span>
        )}
        <button onClick={handleEndTurn}>Turu Bitir</button>
      </div>

      {!specialMode && isPlayerTurn && (
        <p className="throw-hint">Bitişik bir düşmana tıklayarak saldırabilirsin.</p>
      )}
      {error && <p className="error">{error}</p>}

      <div
        ref={gridRef}
        className={`grid ${gridInteractive ? '' : 'grid-disabled'} ${specialMode ? 'grid-throw-mode' : ''}`}
        style={{ gridTemplateColumns: `repeat(${scene.width}, 1fr)` }}
      >
        {rows.map((y) =>
          cols.map((x) => {
            const key = `${x},${y}`;
            const token = tokenMap.get(key);
            const loot = lootMap.get(key);
            const blocked = obstacleSet.has(key);
            let className = 'cell';
            if (blocked) className += ' obstacle';
            if (loot) className += ' loot';
            const isDamageFxCell = damageFx && damageFx.x === x && damageFx.y === y;
            if (isDamageFxCell) className += ' damage-flash';

            const cellLabel = token
              ? `${token.name}${token.hp !== undefined ? ` (${token.hp}/${token.maxHp} HP)` : ''}`
              : loot
                ? loot.name
                : `Boş kare (${x}, ${y})`;

            return (
              <button
                key={key}
                data-x={x}
                data-y={y}
                className={className}
                onClick={() => handleCellClick(x, y)}
                title={cellLabel}
                aria-label={cellLabel}
              >
                {!token && loot ? '◆' : ''}
                {isDamageFxCell && (
                  <span key={damageFx!.key} className="damage-popup">
                    -{damageFx!.damage}
                  </span>
                )}
              </button>
            );
          }),
        )}
        <div className="token-layer">
          {scene.tokens.map((t) => {
            const rect = cellRects.get(`${t.x},${t.y}`);
            if (!rect) return null;
            return (
              <div
                key={t.id}
                className={`token-marker ${t.type === 'player' ? 'player-token' : 'enemy-token'}`}
                style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              >
                {t.name[0]}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
