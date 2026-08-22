import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterCard } from './CharacterCard';
import type { Character } from '../types';

const character: Character = {
  id: 'c1',
  name: 'Testeroth',
  race: 'human',
  class: 'fighter',
  appearance: null,
  level: 1,
  hp: { current: 6, max: 12 },
  mana: { current: 0, max: 0 },
  attributes: { str: 11, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
  inventory: [
    { id: 'i1', name: 'Kısa Kılıç', equipped: false, slot: 'hand' },
    { id: 'i2', name: 'Deri Zırh', equipped: true, slot: 'chest' },
    { id: 'i3', name: 'İksir (Küçük İyileştirme)', equipped: false, slot: null },
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
    expect(screen.getByText('kuşanıldı')).toBeInTheDocument();
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
    await user.click(within(kilicRow).getByRole('button', { name: 'Fırlat' }));

    expect(onStartThrow).toHaveBeenCalledWith('i1');
  });

  it('fırlatma modundaki eşyanın butonu "Hedef Seçiliyor..." olur ve tekrar tıklanınca onCancelThrow çağrılır', async () => {
    const onCancelThrow = vi.fn();
    const user = userEvent.setup();
    render(<CharacterCard character={character} throwingItemId="i1" onCancelThrow={onCancelThrow} />);

    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li')!;
    const throwButton = within(kilicRow).getByRole('button', { name: 'Hedef Seçiliyor...' });
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

describe('CharacterCard — Faz 4-C: ekipman paper-doll', () => {
  it('6 slotu da etiketleriyle render eder', () => {
    render(<CharacterCard character={character} />);
    for (const label of ['Baş', 'Göğüs', 'Kollar', 'El', 'Bacaklar', 'Ayaklar']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('kuşanılmış eşyayı doğru slotta gösterir, boş slotlar "(boş)" yazar', () => {
    render(<CharacterCard character={character} />);
    const chestSlot = screen.getByText('Göğüs').closest('.paper-doll-slot') as HTMLElement;
    expect(within(chestSlot).getByText('Deri Zırh')).toBeInTheDocument();
    expect(chestSlot).toHaveClass('filled');

    const headSlot = screen.getByText('Baş').closest('.paper-doll-slot') as HTMLElement;
    expect(within(headSlot).getByText('(boş)')).toBeInTheDocument();
    expect(headSlot).not.toHaveClass('filled');
  });

  it('kuşanılmamış (equipped: false) bir eşya paper-doll\'da gösterilmez, sadece slot boş kalır', () => {
    render(<CharacterCard character={character} />);
    // Kısa Kılıç equipped:false, "El" slotu boş görünmeli
    const handSlot = screen.getByText('El').closest('.paper-doll-slot') as HTMLElement;
    expect(within(handSlot).getByText('(boş)')).toBeInTheDocument();
  });

  it('slotu olmayan eşyada (İksir) Kuşan/Çıkar butonu gösterilmez', () => {
    render(<CharacterCard character={character} />);
    const potionRow = screen.getByText(/İksir/).closest('li')!;
    expect(within(potionRow).queryByRole('button', { name: /Kuşan|Çıkar/ })).not.toBeInTheDocument();
    // Kullan/At/Fırlat hâlâ olmalı
    expect(within(potionRow).getByRole('button', { name: 'Kullan' })).toBeInTheDocument();
  });

  it('slotu olan eşyada Kuşan/Çıkar butonu gösterilir', () => {
    render(<CharacterCard character={character} />);
    const kilicRow = screen.getByText(/Kısa Kılıç/).closest('li')!;
    expect(within(kilicRow).getByRole('button', { name: 'Kuşan' })).toBeInTheDocument();
  });
});
