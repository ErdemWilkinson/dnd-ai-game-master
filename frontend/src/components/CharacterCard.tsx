import { useState } from 'react';
import { dropItem, equipItem, throwItem, useItem } from '../api';
import { CLASS_NAMES, RACE_NAMES } from '../data/dndNames';
import type { Character } from '../types';

interface Props {
  character: Character;
  onCharacterChange?: (character: Character) => void;
}

const ATTR_LABELS: Record<string, string> = {
  str: 'GÜÇ',
  dex: 'ÇEVİKLİK',
  con: 'DAYANIKLILIK',
  int: 'ZEKA',
  wis: 'BİLGELİK',
  cha: 'KARİZMA',
};

export function CharacterCard({ character, onCharacterChange }: Props) {
  const [throwTargetItemId, setThrowTargetItemId] = useState<string | null>(null);
  const [throwX, setThrowX] = useState('0');
  const [throwY, setThrowY] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const raceName = RACE_NAMES[character.race] ?? character.race;
  const className = CLASS_NAMES[character.class] ?? character.class;

  async function handleUse(itemId: string) {
    setError(null);
    try {
      const { character: updated } = await useItem(character.id, itemId);
      onCharacterChange?.(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleEquip(itemId: string) {
    setError(null);
    try {
      const { character: updated } = await equipItem(character.id, itemId);
      onCharacterChange?.(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDrop(itemId: string) {
    setError(null);
    try {
      const { character: updated } = await dropItem(character.id, itemId);
      onCharacterChange?.(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleThrow(itemId: string) {
    setError(null);
    const x = Number(throwX);
    const y = Number(throwY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setError('Geçersiz koordinat.');
      return;
    }
    try {
      const { character: updated } = await throwItem(character.id, itemId, x, y);
      onCharacterChange?.(updated);
      setThrowTargetItemId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="character-card">
      <h3>{character.name}</h3>
      <p className="character-subtitle">
        {raceName} · {className} · Seviye {character.level}
      </p>

      <div className="bar-row">
        <span>HP</span>
        <div className="bar">
          <div
            className="bar-fill hp"
            style={{ width: `${(character.hp.current / character.hp.max) * 100}%` }}
          />
        </div>
        <span>
          {character.hp.current}/{character.hp.max}
        </span>
      </div>

      <div className="bar-row">
        <span>Mana</span>
        <div className="bar">
          <div
            className="bar-fill mana"
            style={{ width: `${character.mana.max === 0 ? 0 : (character.mana.current / character.mana.max) * 100}%` }}
          />
        </div>
        <span>
          {character.mana.current}/{character.mana.max}
        </span>
      </div>

      <div className="attributes-grid">
        {Object.entries(character.attributes).map(([key, value]) => (
          <div key={key} className="attribute">
            <span className="attribute-label">{ATTR_LABELS[key] ?? key}</span>
            <span className="attribute-value">{value}</span>
          </div>
        ))}
      </div>

      <h4>Envanter</h4>
      {error && <p className="error">{error}</p>}
      <ul className="inventory-list">
        {character.inventory.map((item) => (
          <li key={item.id} className={item.equipped ? 'equipped' : ''}>
            <div className="inventory-item-row">
              <span>
                {item.name} {item.equipped && <span className="tag">kuşanıldı</span>}
              </span>
              <div className="inventory-actions">
                <button type="button" onClick={() => handleUse(item.id)}>
                  Kullan
                </button>
                <button type="button" onClick={() => handleEquip(item.id)}>
                  {item.equipped ? 'Çıkar' : 'Kuşan'}
                </button>
                <button type="button" onClick={() => handleDrop(item.id)}>
                  At
                </button>
                <button
                  type="button"
                  onClick={() => setThrowTargetItemId(throwTargetItemId === item.id ? null : item.id)}
                >
                  Fırlat
                </button>
              </div>
            </div>
            {throwTargetItemId === item.id && (
              <div className="throw-form">
                <label>
                  X
                  <input
                    type="number"
                    value={throwX}
                    onChange={(e) => setThrowX(e.target.value)}
                  />
                </label>
                <label>
                  Y
                  <input
                    type="number"
                    value={throwY}
                    onChange={(e) => setThrowY(e.target.value)}
                  />
                </label>
                <button type="button" onClick={() => handleThrow(item.id)}>
                  Onayla
                </button>
              </div>
            )}
          </li>
        ))}
        {character.inventory.length === 0 && <li className="empty">Envanter boş.</li>}
      </ul>
    </div>
  );
}
