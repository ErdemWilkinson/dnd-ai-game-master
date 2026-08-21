import type { Character } from '../types';

interface Props {
  character: Character;
}

const ATTR_LABELS: Record<string, string> = {
  str: 'GÜÇ',
  dex: 'ÇEVİKLİK',
  con: 'DAYANIKLILIK',
  int: 'ZEKA',
  wis: 'BİLGELİK',
  cha: 'KARİZMA',
};

export function CharacterCard({ character }: Props) {
  return (
    <div className="character-card">
      <h3>{character.name}</h3>
      <p className="character-subtitle">
        {character.race} · {character.class} · Seviye {character.level}
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
      <ul className="inventory-list">
        {character.inventory.map((item) => (
          <li key={item.id} className={item.equipped ? 'equipped' : ''}>
            {item.name} {item.equipped && <span className="tag">kuşanıldı</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
