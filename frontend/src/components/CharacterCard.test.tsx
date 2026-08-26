import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CharacterCard } from './CharacterCard';
import type { Character } from '../types';

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

// Faz 12-C-hazırlık 2 (PM onaylı): CharacterCard artık salt-okunur bir
// karakter kağıdı - saldırı/büyü/eşya kullan/kuşan/al chat üzerinden doğal
// dille yapılıyor. Eskiden burada Kullan/Kuşan/At/Fırlat/Büyü-seç butonlarını
// ve drag-and-drop kuşanmayı test eden çoğu senaryo artık geçersiz (bileşen
// bu API çağrılarını hiç yapmıyor) - test dosyası salt-okunur render'ı
// doğrulayacak şekilde yeniden yazıldı.
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

  it('envanterde hiçbir aksiyon butonu (Kullan/Kuşan/At/Fırlat) YOK - tüm aksiyonlar artık chat üzerinden', () => {
    render(<CharacterCard character={character} />);
    expect(screen.queryByRole('button', { name: /Kullan|Kuşan|Çıkar|At|Fırlat/ })).not.toBeInTheDocument();
  });

  it('büyü listesi/paneli hiç gösterilmiyor - büyü atma artık chat üzerinden', () => {
    const wizard: Character = { ...character, class: 'wizard', mana: { current: 6, max: 10 } };
    render(<CharacterCard character={wizard} />);
    expect(screen.queryByText('Büyüler')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /İyileştir|Ateş Topu/ })).not.toBeInTheDocument();
  });
});

describe('CharacterCard — Faz 5-3: SS13 tarzı ikonlu paper-doll (salt-okunur)', () => {
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
    render(<CharacterCard character={character} />);
    const handSlot = screen.getByText(/^⚔️ El$/).closest('.paper-doll-slot') as HTMLElement;
    expect(within(handSlot).getByText('⚔')).toBeInTheDocument();
  });

  it('paper-doll slotları artık tıklanabilir/sürüklenebilir DEĞİL (buton değil, düz div)', () => {
    render(<CharacterCard character={character} />);
    expect(within(paperDoll()).queryAllByRole('button')).toHaveLength(0);
  });

  it('envanter satırları artık sürüklenebilir DEĞİL (draggable attribute yok)', () => {
    render(<CharacterCard character={character} />);
    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li') as HTMLElement;
    expect(kilicRow).not.toHaveAttribute('draggable');
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
});
