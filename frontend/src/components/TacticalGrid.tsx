import { useEffect, useState } from 'react';
import { endTurn, getScene, moveToken } from '../api';
import type { Scene } from '../types';

export function TacticalGrid() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScene().then(setScene);
  }, []);

  async function handleCellClick(x: number, y: number) {
    if (!scene) return;
    setError(null);
    try {
      const { scene: updated } = await moveToken(scene.activeTokenId, x, y);
      setScene(updated);
    } catch (e) {
      setError((e as Error).message);
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

  return (
    <div className="tactical-grid">
      <div className="scene-header">
        <h3>{scene.name}</h3>
        <span>
          Tur {scene.round} · Sıra: {scene.tokens.find((t) => t.id === scene.activeTokenId)?.name}
        </span>
        <button onClick={handleEndTurn}>Turu Bitir</button>
      </div>

      {error && <p className="error">{error}</p>}

      <div
        className="grid"
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
