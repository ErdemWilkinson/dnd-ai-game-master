import { useState } from 'react';
import { castSpell, consumeItem, dropItem, equipItem } from '../api';
import { CLASS_NAMES, RACE_NAMES } from '../data/dndNames';
import type { Character, EquipmentSlot, SpellId } from '../types';

const SPELLS: { id: SpellId; name: string; manaCost: number; needsTarget: boolean }[] = [
  { id: 'heal', name: 'İyileştir', manaCost: 4, needsTarget: false },
  { id: 'fireball', name: 'Ateş Topu', manaCost: 4, needsTarget: true },
];

// Yaratıcı cron fikir #12: bir sınıfın mana.max'i büyülerin hepsinden düşük
// olabilir (örn. Hırsız: 3 mana, en ucuz büyü 4 mana) - o zaman panel hiç
// gösterilmemeli, aksi halde kullanıcı sürekli devre dışı butonlarla karşılaşır.
const CHEAPEST_SPELL_COST = Math.min(...SPELLS.map((s) => s.manaCost));

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
  onCharacterChange?: (character: Character) => void;
  throwingItemId?: string | null;
  onStartThrow?: (itemId: string) => void;
  onCancelThrow?: () => void;
  castingSpellId?: SpellId | null;
  onStartCast?: (spellId: SpellId) => void;
  onCancelCast?: () => void;
  onChatActivity?: () => void;
  // İnovasyon fikri #69: TacticalGrid'deki "kaynak tükenince devre dışı"
  // (fikir #51) mantığıyla tutarlı - App.tsx sahnedeki oyuncu token'ının
  // actionAvailable/bonusActionAvailable'ını (savaş dışıyken bypass dahil)
  // buraya hazır bir "kullanılabilir mi" booleanı olarak geçiriyor.
  canUseItem?: boolean;
  canThrowItem?: boolean;
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
  castingSpellId = null,
  onStartCast,
  onCancelCast,
  onChatActivity,
  canUseItem = true,
  canThrowItem = true,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  const raceName = RACE_NAMES[character.race] ?? character.race;
  const className = CLASS_NAMES[character.class] ?? character.class;

  async function handleUse(itemId: string) {
    setError(null);
    // İnovasyon fikri #69: TacticalGrid'in fikir #51'deki aynı davranışı -
    // Bonus Aksiyon zaten tükenmişse backend'e hiç gitmeden inline hata
    // gösteriliyor.
    if (!canUseItem) {
      setError('Bu tur için Bonus Aksiyon hakkın kalmadı.');
      return;
    }
    try {
      const { character: updated } = await consumeItem(character.id, itemId);
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

  function handleDragStart(e: React.DragEvent, itemId: string) {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleSlotDragOver(e: React.DragEvent, slot: EquipmentSlot) {
    const draggedId = e.dataTransfer.getData('text/plain');
    const draggedItem = character.inventory.find((i) => i.id === draggedId);
    // getData çoğu tarayıcıda dragover sırasında boş döner (güvenlik kısıtlaması),
    // o yüzden id boşken de preventDefault ediyoruz ki drop hiç engellenmesin.
    if (!draggedId || (draggedItem && draggedItem.slot === slot)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleSlotDrop(e: React.DragEvent, slot: EquipmentSlot) {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    const item = character.inventory.find((i) => i.id === itemId);
    if (item && item.slot === slot && !item.equipped) {
      handleEquip(itemId);
    }
  }

  function handleThrowClick(itemId: string) {
    setError(null);
    if (throwingItemId === itemId) {
      onCancelThrow?.();
      return;
    }
    // İnovasyon fikri #69: Aksiyon zaten tükenmişse hedef-seç moduna hiç
    // girmiyoruz - girip sonra backend 400 döndürmesindense en baştan
    // engellemek daha net.
    if (!canThrowItem) {
      setError('Bu tur için Aksiyon hakkın kalmadı.');
      return;
    }
    onStartThrow?.(itemId);
  }

  async function handleSpellClick(spell: (typeof SPELLS)[number]) {
    setError(null);
    if (spell.needsTarget) {
      if (castingSpellId === spell.id) {
        onCancelCast?.();
      } else {
        onStartCast?.(spell.id);
      }
      return;
    }
    try {
      const { character: updated } = await castSpell(character.id, spell.id);
      onCharacterChange?.(updated);
      onChatActivity?.();
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

      <div className="bar-row">
        <span>🔮 Mana</span>
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

      {character.mana.max >= CHEAPEST_SPELL_COST && (
        <>
          <h4>✨ Büyüler</h4>
          <div className="spell-list">
            {SPELLS.map((spell) => (
              <button
                key={spell.id}
                type="button"
                className={castingSpellId === spell.id ? 'active' : ''}
                disabled={character.mana.current < spell.manaCost}
                onClick={() => handleSpellClick(spell)}
                title={`${spell.manaCost} mana`}
              >
                {castingSpellId === spell.id ? 'Hedef Seçiliyor...' : `${spell.name} (${spell.manaCost} mana)`}
              </button>
            ))}
          </div>
        </>
      )}

      <h4>🎽 Ekipman</h4>
      <div className="paper-doll">
        {SLOT_ORDER.map((slot) => {
          const equippedItem = character.inventory.find((i) => i.slot === slot && i.equipped);
          const glyph = SLOT_FALLBACK_GLYPH[slot];
          return (
            <button
              key={slot}
              type="button"
              className={`paper-doll-slot ${equippedItem ? 'filled' : ''}`}
              onClick={() => equippedItem && handleEquip(equippedItem.id)}
              onDragOver={(e) => handleSlotDragOver(e, slot)}
              onDrop={(e) => handleSlotDrop(e, slot)}
              title={equippedItem ? `${equippedItem.name} (çıkarmak için tıkla)` : `${SLOT_LABELS[slot]} (boş)`}
              aria-label={equippedItem ? `${equippedItem.name} (çıkarmak için tıkla)` : `${SLOT_LABELS[slot]} (boş)`}
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
            </button>
          );
        })}
      </div>

      <h4>🎒 Envanter</h4>
      {error && <p className="error">{error}</p>}
      {throwingItemId && (
        <p className="throw-hint">Fırlatmak için taktik haritada bir kareye tıkla (iptal için tekrar Fırlat'a bas).</p>
      )}
      <ul className="inventory-list">
        {character.inventory.map((item) => (
          <li
            key={item.id}
            className={item.equipped ? 'equipped' : ''}
            draggable={!!item.slot && !item.equipped}
            onDragStart={(e) => handleDragStart(e, item.id)}
          >
            <div className="inventory-item-row">
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
              <div className="inventory-actions">
                {!item.slot && (
                  <button
                    type="button"
                    onClick={() => handleUse(item.id)}
                    disabled={!canUseItem}
                    title={canUseItem ? undefined : 'Bu tur için Bonus Aksiyon hakkın kalmadı.'}
                  >
                    🧪 Kullan
                  </button>
                )}
                {item.slot && (
                  <button type="button" onClick={() => handleEquip(item.id)}>
                    {item.equipped ? '🎽 Çıkar' : '🎽 Kuşan'}
                  </button>
                )}
                <button type="button" onClick={() => handleDrop(item.id)}>
                  🗑️ At
                </button>
                <button
                  type="button"
                  className={throwingItemId === item.id ? 'active' : ''}
                  onClick={() => handleThrowClick(item.id)}
                  disabled={throwingItemId !== item.id && !canThrowItem}
                  title={canThrowItem || throwingItemId === item.id ? undefined : 'Bu tur için Aksiyon hakkın kalmadı.'}
                >
                  {throwingItemId === item.id ? '🎯 Hedef Seçiliyor...' : '🎯 Fırlat'}
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
