import { CLASS_NAMES, RACE_NAMES } from '../data/dndNames';
import type { Character, EquipmentSlot } from '../types';

// Yaratıcı cron fikir #38: backend/services/leveling.js'teki formülün
// (xpToNextLevel(level)=level*50, MAX_LEVEL=20) frontend karşılığı - basit
// bir sabit/formül olduğundan API'den ayrıca çekmek yerine burada da
// tutarlı şekilde tekrarlandı (proje genelinde kod paylaşımı yok).
const MAX_LEVEL = 20;

// Yaratıcı cron fikir #49: fikir #15'teki 🧪 fallback `!item.slot` koşuluyla
// TÜM slotsuz eşyalarda (Büyü Kitabı/Hırsız Aletleri/Kutsal Sembol de dahil,
// sadece iksir değil) tetikleniyordu - backend'deki weaponDamage.js/
// armorReduction.js'teki isme-göre-eşleme deseniyle tutarlı bir harita.
const CONSUMABLE_ICONS: Record<string, string> = {
  'Büyü Kitabı': '📖',
  'Hırsız Aletleri': '🗝️',
  'Kutsal Sembol': '✨',
  // Yaratıcı cron fikir #54: loot trofe eşyaları (data/encounters.js) de
  // slotsuz olduğundan yanlışlıkla 🧪 gösteriyordu.
  'Altın Kese': '💰',
  'Örümcek İpeği': '🕸️',
  'Ejderha Pulu': '🐉',
};
const DEFAULT_CONSUMABLE_ICON = '🧪';

function getConsumableIcon(itemName: string): string {
  return CONSUMABLE_ICONS[itemName] ?? DEFAULT_CONSUMABLE_ICON;
}

// Yaratıcı cron fikir #50: eskiden `!item.slot` koşulu, "hand" slotlu
// eşyaların (silahlar - asset setinde ikonu yok) envanter listesinde HİÇ
// fallback göstermemesine yol açıyordu (paper-doll'da `SLOT_FALLBACK_GLYPH`
// zaten ⚔ gösteriyordu, envanter listesi bundan habersizdi). Artık "resim
// yoksa fallback göster" mantığı - slotu ne olursa olsun.
function getInventoryFallbackIcon(item: { slot: EquipmentSlot | null; name: string }): string | null {
  if (item.slot) return SLOT_FALLBACK_GLYPH[item.slot] ?? null;
  return getConsumableIcon(item.name);
}
function xpToNextLevel(level: number) {
  return level * 50;
}

// SS13 (tgstation ikon seti) tarzı genişletilmiş paper-doll slot düzeni.
const SLOT_ORDER: EquipmentSlot[] = [
  'head',
  'mask',
  'glasses',
  'ears',
  'neck',
  'back',
  'suit',
  'under',
  'gloves',
  'belt',
  'shoes',
  'accessories',
  'hand',
];

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Baş',
  mask: 'Maske',
  glasses: 'Gözlük',
  ears: 'Kulak',
  neck: 'Boyun',
  back: 'Sırt',
  suit: 'Zırh',
  under: 'Üst Giysi',
  gloves: 'Eldiven',
  belt: 'Kemer',
  shoes: 'Ayakkabı',
  accessories: 'Aksesuar',
  hand: 'El',
};

// tgstation ikon setinde silah ikonu yok - "hand" slotu için emoji fallback.
const SLOT_FALLBACK_GLYPH: Partial<Record<EquipmentSlot, string>> = {
  hand: '⚔',
};

const SLOT_EMOJI: Record<EquipmentSlot, string> = {
  head: '🪖',
  mask: '😷',
  glasses: '👓',
  ears: '👂',
  neck: '📿',
  back: '🎒',
  suit: '🥋',
  under: '👕',
  gloves: '🧤',
  belt: '🪢',
  shoes: '👢',
  accessories: '💍',
  hand: '⚔️',
};

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

// Faz 12-C-hazırlık 2 (PM onaylı, "menü/buton yok" vizyonu): saldırı/büyü/
// eşya kullan/kuşan/al artık chat üzerinden doğal dille yapılıyor
// (services/freeformCombat.js) - bu bileşen artık salt-okunur bir karakter
// kağıdı. Eskiden burada Kullan/Kuşan/At/Fırlat/Büyü-seç butonları ve
// drag-and-drop kuşanma vardı, hepsi kaldırıldı (eşya atma/throw için
// freeform karşılığı bilinçli olarak eklenmedi - kabul edilebilir bir kayıp,
// bkz. TASKS.md).
export function CharacterCard({ character }: Props) {
  const raceName = RACE_NAMES[character.race] ?? character.race;
  const className = CLASS_NAMES[character.class] ?? character.class;

  return (
    <div className="character-card">
      <h3>{character.name}</h3>
      <p className="character-subtitle">
        {raceName} · {className} · Seviye {character.level}
      </p>

      <div className="bar-row">
        <span>❤️ HP</span>
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
        <span>⭐ XP</span>
        {character.level >= MAX_LEVEL ? (
          <>
            <div className="bar">
              <div className="bar-fill xp" style={{ width: '100%' }} />
            </div>
            <span>MAX</span>
          </>
        ) : (
          <>
            <div className="bar">
              <div
                className="bar-fill xp"
                style={{ width: `${(character.xp / xpToNextLevel(character.level)) * 100}%` }}
              />
            </div>
            <span>
              {character.xp}/{xpToNextLevel(character.level)}
            </span>
          </>
        )}
      </div>

      {character.mana.max > 0 && (
        <div className="bar-row">
          <span>🔮 Mana</span>
          <div className="bar">
            <div
              className="bar-fill mana"
              style={{ width: `${(character.mana.current / character.mana.max) * 100}%` }}
            />
          </div>
          <span>
            {character.mana.current}/{character.mana.max}
          </span>
        </div>
      )}

      <div className="attributes-grid">
        {Object.entries(character.attributes).map(([key, value]) => (
          <div key={key} className="attribute">
            <span className="attribute-label">{ATTR_LABELS[key] ?? key}</span>
            <span className="attribute-value">{value}</span>
          </div>
        ))}
      </div>

      <h4>🎽 Ekipman</h4>
      <div className="paper-doll">
        {SLOT_ORDER.map((slot) => {
          const equippedItem = character.inventory.find((i) => i.slot === slot && i.equipped);
          const glyph = SLOT_FALLBACK_GLYPH[slot];
          return (
            <div
              key={slot}
              className={`paper-doll-slot ${equippedItem ? 'filled' : ''}`}
              title={equippedItem ? equippedItem.name : `${SLOT_LABELS[slot]} (boş)`}
            >
              <span className="slot-icon">
                {equippedItem?.icon ? (
                  <img src={equippedItem.icon} alt={equippedItem.name} width={28} height={28} />
                ) : (
                  glyph ?? '·'
                )}
              </span>
              <span className="slot-label">
                {SLOT_EMOJI[slot]} {SLOT_LABELS[slot]}
              </span>
            </div>
          );
        })}
      </div>

      <h4>🎒 Envanter</h4>
      <ul className="inventory-list">
        {character.inventory.map((item) => (
          <li key={item.id} className={item.equipped ? 'equipped' : ''}>
            <span className="inventory-item-name">
              {item.icon ? (
                <img className="inventory-icon" src={item.icon} alt="" width={20} height={20} />
              ) : (
                (() => {
                  const glyph = getInventoryFallbackIcon(item);
                  return glyph ? <span className="inventory-icon-fallback">{glyph}</span> : null;
                })()
              )}
              {item.name} {item.equipped && <span className="tag">🎽 kuşanıldı</span>}
            </span>
          </li>
        ))}
        {character.inventory.length === 0 && <li className="empty">Envanter boş.</li>}
      </ul>
    </div>
  );
}
