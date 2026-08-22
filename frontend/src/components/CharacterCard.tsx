import { useState } from 'react';
import { dropItem, equipItem, useItem } from '../api';
import { CLASS_NAMES, RACE_NAMES } from '../data/dndNames';
import type { Character, EquipmentSlot } from '../types';

const SLOT_ORDER: EquipmentSlot[] = ['head', 'chest', 'arms', 'hand', 'legs', 'feet'];

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Baş',
  chest: 'Göğüs',
  arms: 'Kollar',
  hand: 'El',
  legs: 'Bacaklar',
  feet: 'Ayaklar',
};

interface Props {
  character: Character;
  onCharacterChange?: (character: Character) => void;
  throwingItemId?: string | null;
  onStartThrow?: (itemId: string) => void;
  onCancelThrow?: () => void;
}

const ATTR_LABELS: Record<string, string> = {
  str: 'GÜÇ',
  dex: 'ÇEVİKLİK',
  con: 'DAYANIKLILIK',
  int: 'ZEKA',
  wis: 'BİLGELİK',
  cha: 'KARİZMA',
};

export function CharacterCard({
  character,
  onCharacterChange,
  throwingItemId = null,
  onStartThrow,
  onCancelThrow,
}: Props) {
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

  function handleThrowClick(itemId: string) {
    setError(null);
    if (throwingItemId === itemId) {
      onCancelThrow?.();
    } else {
      onStartThrow?.(itemId);
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

      <h4>Ekipman</h4>
      <div className="paper-doll">
        {SLOT_ORDER.map((slot) => {
          const equippedItem = character.inventory.find((i) => i.slot === slot && i.equipped);
          return (
            <div key={slot} className={`paper-doll-slot ${equippedItem ? 'filled' : ''}`}>
              <span className="slot-label">{SLOT_LABELS[slot]}</span>
              <span className="slot-item">{equippedItem?.name ?? '(boş)'}</span>
            </div>
          );
        })}
      </div>

      <h4>Envanter</h4>
      {error && <p className="error">{error}</p>}
      {throwingItemId && (
        <p className="throw-hint">Fırlatmak için taktik haritada bir kareye tıkla (iptal için tekrar Fırlat'a bas).</p>
      )}
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
                {item.slot && (
                  <button type="button" onClick={() => handleEquip(item.id)}>
                    {item.equipped ? 'Çıkar' : 'Kuşan'}
                  </button>
                )}
                <button type="button" onClick={() => handleDrop(item.id)}>
                  At
                </button>
                <button
                  type="button"
                  className={throwingItemId === item.id ? 'active' : ''}
                  onClick={() => handleThrowClick(item.id)}
                >
                  {throwingItemId === item.id ? 'Hedef Seçiliyor...' : 'Fırlat'}
                </button>
              </div>
            </div>
          </li>
        ))}
        {character.inventory.length === 0 && <li className="empty">Envanter boş.</li>}
      </ul>
    </div>
  );
}
