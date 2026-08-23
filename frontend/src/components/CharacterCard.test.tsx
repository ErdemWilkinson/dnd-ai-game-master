import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterCard } from './CharacterCard';
import * as api from '../api';
import type { Character } from '../types';

// CharacterCard, use/equip/drop için '../api'yi doğrudan çağırıyor (prop
// olarak enjekte edilmiyor). Slota tıklayınca çıkarma akışını test etmek
// için gerçek fetch'e gitmesini engellemek adına burada mock'luyoruz.
vi.mock('../api');

const character: Character = {
  id: 'c1',
  name: 'Testeroth',
  race: 'human',
  class: 'fighter',
  appearance: null,
  level: 1,
  xp: 0,
  hp: { current: 6, max: 12 },
  mana: { current: 0, max: 0 },
  attributes: { str: 11, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
  inventory: [
    { id: 'i1', name: 'Kısa Kılıç', equipped: false, slot: 'hand', icon: null },
    { id: 'i2', name: 'Deri Zırh', equipped: true, slot: 'suit', icon: '/icons/suit.png' },
    { id: 'i3', name: 'İksir (Küçük İyileştirme)', equipped: false, slot: null, icon: null },
  ],
};

describe('CharacterCard', () => {
  it('HP ve mana değerlerini gösterir', () => {
    render(<CharacterCard character={character} />);
    expect(screen.getByText('6/12')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('envanterdeki eşyaları listeler', () => {
    render(<CharacterCard character={character} />);
    const inventoryList = document.querySelector('.inventory-list') as HTMLElement;
    expect(within(inventoryList).getByText(/Kısa Kılıç/)).toBeInTheDocument();
    expect(within(inventoryList).getByText(/Deri Zırh/)).toBeInTheDocument();
    expect(screen.getByText(/kuşanıldı/)).toBeInTheDocument();
  });

  it('ırk/sınıf Türkçe görünen adla gösterilir (Bug #3, Faz 1.5\'te düzeltildi)', () => {
    render(<CharacterCard character={character} />);
    expect(screen.getByText(/İnsan · Savaşçı/i)).toBeInTheDocument();
  });
});

describe('CharacterCard — Faz 3-E: fırlatma tetikleme', () => {
  it('"Fırlat" tıklanınca onStartThrow ilgili itemId ile çağrılır', async () => {
    const onStartThrow = vi.fn();
    const user = userEvent.setup();
    render(<CharacterCard character={character} onStartThrow={onStartThrow} />);

    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li')!;
    await user.click(within(kilicRow).getByRole('button', { name: /Fırlat/ }));

    expect(onStartThrow).toHaveBeenCalledWith('i1');
  });

  it('fırlatma modundaki eşyanın butonu "Hedef Seçiliyor..." olur ve tekrar tıklanınca onCancelThrow çağrılır', async () => {
    const onCancelThrow = vi.fn();
    const user = userEvent.setup();
    render(<CharacterCard character={character} throwingItemId="i1" onCancelThrow={onCancelThrow} />);

    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li')!;
    const throwButton = within(kilicRow).getByRole('button', { name: /Hedef Seçiliyor.../ });
    expect(throwButton).toBeInTheDocument();

    await user.click(throwButton);
    expect(onCancelThrow).toHaveBeenCalledTimes(1);
  });

  it('throwingItemId set iken kullanıcıya ipucu metni gösterilir', () => {
    render(<CharacterCard character={character} throwingItemId="i1" />);
    expect(screen.getByText(/taktik haritada bir kareye tıkla/i)).toBeInTheDocument();
  });

  it('throwingItemId yokken ipucu metni gösterilmez', () => {
    render(<CharacterCard character={character} />);
    expect(screen.queryByText(/taktik haritada bir kareye tıkla/i)).not.toBeInTheDocument();
  });
});

describe('CharacterCard — Faz 5-3: SS13 tarzı ikonlu paper-doll', () => {
  const ALL_SLOT_LABELS = [
    'Baş', 'Maske', 'Gözlük', 'Kulak', 'Boyun', 'Sırt',
    'Zırh', 'Üst Giysi', 'Eldiven', 'Kemer', 'Ayakkabı', 'Aksesuar', 'El',
  ];

  function paperDoll() {
    return document.querySelector('.paper-doll') as HTMLElement;
  }

  it('13 SS13 slotunun hepsini etiketleriyle render eder', () => {
    render(<CharacterCard character={character} />);
    for (const label of ALL_SLOT_LABELS) {
      // anchored: "El" olmasa "Eldiven" etiketiyle de eşleşip belirsizlik yaratırdı
      expect(within(paperDoll()).getByText(new RegExp(`\\s${label}$`))).toBeInTheDocument();
    }
  });

  it('kuşanılmış eşyayı doğru slotta ikonuyla gösterir ("filled" class)', () => {
    render(<CharacterCard character={character} />);
    const suitSlot = within(paperDoll()).getByText(/Zırh/).closest('.paper-doll-slot') as HTMLElement;
    expect(suitSlot).toHaveClass('filled');
    const img = within(suitSlot).getByRole('img', { name: 'Deri Zırh' });
    expect(img).toHaveAttribute('src', '/icons/suit.png');
  });

  it('boş bir slot (ikonu olan türden) "filled" class almaz, yer tutucu "·" gösterir', () => {
    render(<CharacterCard character={character} />);
    const headSlot = within(paperDoll()).getByText(/Baş/).closest('.paper-doll-slot') as HTMLElement;
    expect(headSlot).not.toHaveClass('filled');
    expect(within(headSlot).getByText('·')).toBeInTheDocument();
  });

  it('kuşanılmamış (equipped: false) bir eşya paper-doll\'da gösterilmez, slot boş kalır', () => {
    render(<CharacterCard character={character} />);
    // Kısa Kılıç equipped:false, "El" slotu boş görünmeli (glyph fallback ⚔ değil, boş hâli)
    const handSlot = screen.getByText(/^⚔️ El$/).closest('.paper-doll-slot') as HTMLElement;
    expect(handSlot).not.toHaveClass('filled');
  });

  it('"hand" slotu (asset setinde ikonu yok) boşken bile ⚔ emoji fallback\'i gösterir', () => {
    // Not: SLOT_FALLBACK_GLYPH sadece 'hand' için tanımlı ve equippedItem'dan
    // bağımsız render ediliyor (bkz. CharacterCard.tsx: glyph ?? '·') — yani
    // "El" slotu boşken de ⚔ görünüyor, dolu olduğunda ikon varsa ikon
    // gösteriliyor. Bu, tester tarafından bilinçli belgelenen bir davranış.
    render(<CharacterCard character={character} />);
    const handSlot = screen.getByText(/^⚔️ El$/).closest('.paper-doll-slot') as HTMLElement;
    expect(within(handSlot).getByText('⚔')).toBeInTheDocument();
  });

  it('dolu bir slota tıklamak eşyayı çıkarır (equipItem çağrılır), boş slot tıklamak no-op kalır', async () => {
    vi.mocked(api.equipItem).mockResolvedValue({
      character: { ...character, inventory: character.inventory.map((i) => (i.id === 'i2' ? { ...i, equipped: false } : i)) },
    });
    const onCharacterChange = vi.fn();
    const user = userEvent.setup();
    render(<CharacterCard character={character} onCharacterChange={onCharacterChange} />);

    const suitSlot = within(paperDoll()).getByText(/Zırh/).closest('.paper-doll-slot') as HTMLElement;
    expect(suitSlot).toHaveClass('filled');
    await user.click(suitSlot);
    await waitFor(() => expect(onCharacterChange).toHaveBeenCalled());
    expect(api.equipItem).toHaveBeenCalledWith('c1', 'i2');

    // Faz 8: boş slotlarda artık HTML disabled attribute yok (drag/drop event'i
    // alabilmesi için kaldırıldı), guard onClick içinde (`equippedItem && ...`).
    const headSlot = within(paperDoll()).getByText(/Baş/).closest('.paper-doll-slot') as HTMLElement;
    expect(headSlot).not.toHaveClass('filled');
    await user.click(headSlot);
    expect(api.equipItem).toHaveBeenCalledTimes(1); // boş slota tıklamak yeni bir çağrı tetiklemedi
  });

  function makeDataTransfer() {
    const data: Record<string, string> = {};
    return {
      setData: (type: string, val: string) => { data[type] = val; },
      getData: (type: string) => data[type] ?? '',
      dropEffect: '',
      effectAllowed: '',
    };
  }

  it('Faz 8: eşyayı sürükleyip uygun slota bırakınca kuşanılır (drag-and-drop)', async () => {
    vi.mocked(api.equipItem).mockResolvedValue({
      character: { ...character, inventory: character.inventory.map((i) => (i.id === 'i1' ? { ...i, equipped: true } : i)) },
    });
    const onCharacterChange = vi.fn();
    render(<CharacterCard character={character} onCharacterChange={onCharacterChange} />);

    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li') as HTMLElement;
    expect(kilicRow).toHaveAttribute('draggable', 'true');
    const handSlot = screen.getByText(/^⚔️ El$/).closest('.paper-doll-slot') as HTMLElement;
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(kilicRow, { dataTransfer });
    fireEvent.dragOver(handSlot, { dataTransfer });
    fireEvent.drop(handSlot, { dataTransfer });

    await waitFor(() => expect(api.equipItem).toHaveBeenCalledWith('c1', 'i1'));
    expect(onCharacterChange).toHaveBeenCalled();
  });

  it('Faz 8: eşyayı slotu uyuşmayan bir hedefe bırakmak kuşandırmaz (sessizce yok sayılır)', () => {
    vi.mocked(api.equipItem).mockClear();
    render(<CharacterCard character={character} />);

    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li') as HTMLElement;
    const headSlot = within(paperDoll()).getByText(/Baş/).closest('.paper-doll-slot') as HTMLElement;
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(kilicRow, { dataTransfer });
    fireEvent.drop(headSlot, { dataTransfer });

    expect(api.equipItem).not.toHaveBeenCalled();
  });

  it('Faz 8: kuşanılı bir eşya sürüklenemez (draggable=false)', () => {
    render(<CharacterCard character={character} />);
    const zirhRow = screen.getByText(/Deri Zırh/).closest('li') as HTMLElement;
    expect(zirhRow).toHaveAttribute('draggable', 'false');
  });

  it('envanter listesindeki eşya ikonu varsa küçük bir thumbnail gösterir', () => {
    // Not: thumbnail'de alt="" kullanılıyor (isim zaten yanında yazılı olduğu
    // için dekoratif kabul ediliyor) — bu da erişilebilirlik ağacında "img"
    // rolünü kaldırıyor, o yüzden CSS class ile sorguluyoruz, getByRole ile değil.
    render(<CharacterCard character={character} />);
    const inventoryList = document.querySelector('.inventory-list') as HTMLElement;
    const zirhRow = within(inventoryList).getByText(/Deri Zırh/).closest('li')!;
    const thumb = zirhRow.querySelector('img.inventory-icon');
    expect(thumb).toHaveAttribute('src', '/icons/suit.png');
  });

  it('envanterdeki ikonu olmayan eşya (Kısa Kılıç, hand) thumbnail göstermez', () => {
    render(<CharacterCard character={character} />);
    const inventoryList = document.querySelector('.inventory-list') as HTMLElement;
    const kilicRow = within(inventoryList).getByText(/Kısa Kılıç/).closest('li')!;
    expect(kilicRow.querySelector('img.inventory-icon')).not.toBeInTheDocument();
  });

  it('slotu olmayan eşyada (İksir) Kuşan/Çıkar butonu gösterilmez', () => {
    render(<CharacterCard character={character} />);
    const potionRow = screen.getByText(/İksir/).closest('li')!;
    expect(within(potionRow).queryByRole('button', { name: /Kuşan|Çıkar/ })).not.toBeInTheDocument();
    // Kullan/At/Fırlat hâlâ olmalı
    expect(within(potionRow).getByRole('button', { name: /Kullan/ })).toBeInTheDocument();
  });

  it('slotu olan eşyada Kuşan/Çıkar butonu gösterilir', () => {
    render(<CharacterCard character={character} />);
    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li')!;
    expect(within(kilicRow).getByRole('button', { name: /Kuşan/ })).toBeInTheDocument();
  });

  it('Faz 8: slotu olan eşyada (Kısa Kılıç) "Kullan" butonu HİÇ gösterilmez', () => {
    render(<CharacterCard character={character} />);
    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li')!;
    expect(within(kilicRow).queryByRole('button', { name: /Kullan/ })).not.toBeInTheDocument();
  });
});

describe('CharacterCard — Faz 6-C: büyü listesi', () => {
  const wizard: Character = {
    ...character,
    mana: { current: 6, max: 10 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mana.max 0 olan bir karakterde (büyü kullanmayan sınıf) "Büyüler" bölümü gösterilmez', () => {
    render(<CharacterCard character={character} />);
    expect(screen.queryByText('Büyüler')).not.toBeInTheDocument();
  });

  it('mana kullanan bir karakterde büyü butonları mana maliyetiyle gösterilir', () => {
    render(<CharacterCard character={wizard} />);
    expect(screen.getByText(/Büyüler/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /İyileştir \(4 mana\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ateş Topu \(4 mana\)/ })).toBeInTheDocument();
  });

  it('mana yetersizse büyü butonu devre dışı kalır', () => {
    const lowMana: Character = { ...character, mana: { current: 1, max: 10 } };
    render(<CharacterCard character={lowMana} />);
    expect(screen.getByRole('button', { name: /İyileştir/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Ateş Topu/ })).toBeDisabled();
  });

  it('İyileştir (hedefsiz büyü) tıklanınca doğrudan castSpell çağrılır, hedef seçim moduna girmez', async () => {
    vi.mocked(api.castSpell).mockResolvedValue({
      character: { ...wizard, hp: { current: wizard.hp.max, max: wizard.hp.max } },
      scene: {} as never,
      spell: 'heal',
      healed: 8,
      narration: { text: 'İyileştin.', source: 'mock' },
    });
    const onCharacterChange = vi.fn();
    const onChatActivity = vi.fn();
    const onStartCast = vi.fn();
    const user = userEvent.setup();
    render(
      <CharacterCard
        character={wizard}
        onCharacterChange={onCharacterChange}
        onChatActivity={onChatActivity}
        onStartCast={onStartCast}
      />,
    );

    await user.click(screen.getByRole('button', { name: /İyileştir/ }));

    expect(api.castSpell).toHaveBeenCalledWith('c1', 'heal');
    expect(onStartCast).not.toHaveBeenCalled();
    await waitFor(() => expect(onCharacterChange).toHaveBeenCalled());
    expect(onChatActivity).toHaveBeenCalledTimes(1);
  });

  it('Ateş Topu (hedefli büyü) tıklanınca castSpell ÇAĞRILMAZ, onStartCast ile hedef seçim moduna girilir', async () => {
    const onStartCast = vi.fn();
    const user = userEvent.setup();
    render(<CharacterCard character={wizard} onStartCast={onStartCast} />);

    await user.click(screen.getByRole('button', { name: /Ateş Topu/ }));

    expect(onStartCast).toHaveBeenCalledWith('fireball');
    expect(api.castSpell).not.toHaveBeenCalled();
  });

  it('castingSpellId ilgili büyünün id\'sine eşitse buton "Hedef Seçiliyor..." olur ve tekrar tıklayınca onCancelCast çağrılır', async () => {
    const onCancelCast = vi.fn();
    const user = userEvent.setup();
    render(<CharacterCard character={wizard} castingSpellId="fireball" onCancelCast={onCancelCast} />);

    const activeButton = screen.getByRole('button', { name: 'Hedef Seçiliyor...' });
    expect(activeButton).toHaveClass('active');

    await user.click(activeButton);
    expect(onCancelCast).toHaveBeenCalledTimes(1);
  });
});
