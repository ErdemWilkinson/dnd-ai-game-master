import { useEffect, useState } from 'react';
import { endTurn, getScene, moveToken, throwItem } from '../api';
import type { Character, Scene } from '../types';

interface Props {
  characterId: string;
  throwingItemId?: string | null;
  onThrowComplete?: (character: Character) => void;
  refreshKey?: number;
}

export function TacticalGrid({ characterId, throwingItemId = null, onThrowComplete, refreshKey = 0 }: Props) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScene().then(setScene);
  }, [refreshKey]);

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

  async function handleMoveTarget(x: number, y: number) {
    if (!scene) return;
    const activeToken = scene.tokens.find((t) => t.id === scene.activeTokenId);
    if (activeToken?.type !== 'player') {
      setError('Sıra sende değil.');
      return;
    }
    setError(null);
    try {
      const { scene: updated } = await moveToken(scene.activeTokenId, x, y);
      setScene(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleCellClick(x: number, y: number) {
    if (throwingItemId) {
      handleThrowTarget(x, y);
    } else {
      handleMoveTarget(x, y);
    }
  }

  async function handleEndTurn() {
    const updated = await endTurn();
    setScene(updated);
  }

  if (!scene) return <div className="tactical-grid">Harita yükleniyor...</div>;

  const obstacleSet = new Set(scene.obstacles.map((o) => `${o.x},${o.y}`));
  const lootMap = new Map(scene.loot.map((l) => [`${l.x},${l.y}`, l]));
  const tokenMap = new Map(scene.tokens.map((t) => [`${t.x},${t.y}`, t]));

  const rows = Array.from({ length: scene.height }, (_, y) => y);
  const cols = Array.from({ length: scene.width }, (_, x) => x);
  const activeToken = scene.tokens.find((t) => t.id === scene.activeTokenId);
  const isPlayerTurn = activeToken?.type === 'player';
  const gridInteractive = throwingItemId ? true : isPlayerTurn;
  const playerToken = scene.tokens.find((t) => t.id === 'player');

  return (
    <div className="tactical-grid">
      <div className="scene-header">
        <h3>{scene.name}</h3>
        <span>
          {throwingItemId
            ? 'Fırlatma hedefi seç'
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

      {error && <p className="error">{error}</p>}

      <div
        className={`grid ${gridInteractive ? '' : 'grid-disabled'} ${throwingItemId ? 'grid-throw-mode' : ''}`}
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
            if (token) className += token.type === 'player' ? ' player-token' : ' enemy-token';
            if (loot) className += ' loot';

            return (
              <button
                key={key}
                className={className}
                onClick={() => handleCellClick(x, y)}
                title={token?.name ?? loot?.name ?? ''}
              >
                {token ? token.name[0] : loot ? '◆' : ''}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
