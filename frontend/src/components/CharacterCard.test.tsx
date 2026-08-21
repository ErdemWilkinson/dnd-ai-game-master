import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterCard } from './CharacterCard';
import type { Character } from '../types';

const character: Character = {
  id: 'c1',
  name: 'Testeroth',
  race: 'human',
  class: 'fighter',
  level: 1,
  hp: { current: 6, max: 12 },
  mana: { current: 0, max: 0 },
  attributes: { str: 11, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
  inventory: [
    { id: 'i1', name: 'Kısa Kılıç', equipped: false },
    { id: 'i2', name: 'Deri Zırh', equipped: true },
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
    expect(screen.getByText(/Kısa Kılıç/)).toBeInTheDocument();
    expect(screen.getByText(/Deri Zırh/)).toBeInTheDocument();
    expect(screen.getByText('kuşanıldı')).toBeInTheDocument();
  });

  it('ırk/sınıf Türkçe görünen adla gösterilmeli (şu an ham id gösteriliyor — bkz. TASKS.md Bulunan Buglar #3)', () => {
    // Bilinçli olarak KIRMIZI bırakılan bir test: mevcut davranış ham id ("human · fighter")
    // gösteriyor, ama arayüzün geri kalanı Türkçe (İnsan, Savaşçı vb). Coder RACES/CLASSES
    // tablosundan 'name' alanını kullanacak şekilde düzeltmeli.
    render(<CharacterCard character={character} />);
    expect(screen.getByText(/İnsan · Savaşçı/i)).toBeInTheDocument();
  });
});
