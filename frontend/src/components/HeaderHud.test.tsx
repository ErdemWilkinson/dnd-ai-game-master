import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HeaderHud } from './HeaderHud';
import type { Character } from '../types';

const character: Character = {
  id: 'c1',
  name: 'Testeroth',
  race: 'human',
  class: 'wizard',
  appearance: null,
  level: 3,
  xp: 40,
  hp: { current: 8, max: 12 },
  mana: { current: 5, max: 10 },
  attributes: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
  inventory: [],
};

// Yaratıcı cron fikir #101: HeaderHud.tsx hiç test dosyasına sahip değildi -
// fikir #89'un aria-live/aria-atomic düzeltmesi dahil hiçbir davranışı
// doğrulanmıyordu. GameOverScreen.test.tsx'teki #86 testiyle aynı desen.
describe('HeaderHud — İnovasyon fikri #89/#101', () => {
  it('HP, mana ve seviyeyi gösterir', () => {
    render(<HeaderHud character={character} />);
    expect(document.querySelector('.header-hud-hp')).toHaveTextContent('8/12');
    expect(document.querySelector('.header-hud-mana')).toHaveTextContent('5/10');
    expect(document.querySelector('.header-hud-level')).toHaveTextContent('Lv 3');
  });

  it('mana.max===0 (Fighter gibi mana kullanmayan sınıf) iken mana şeridi hiç render edilmiyor', () => {
    const fighter: Character = { ...character, class: 'fighter', mana: { current: 0, max: 0 } };
    render(<HeaderHud character={fighter} />);
    expect(document.querySelector('.header-hud-mana')).not.toBeInTheDocument();
  });

  it('İnovasyon fikri #89: kök element aria-live="polite" + aria-atomic="true" taşır ki HP/Mana değişiklikleri ekran okuyucuya duyurulsun', () => {
    render(<HeaderHud character={character} />);
    const hud = document.querySelector('.header-hud') as HTMLElement;
    expect(hud).toHaveAttribute('aria-live', 'polite');
    expect(hud).toHaveAttribute('aria-atomic', 'true');
  });

  it('aria-label karakter adı, HP ve seviyeyi özetler', () => {
    render(<HeaderHud character={character} />);
    const hud = document.querySelector('.header-hud') as HTMLElement;
    expect(hud).toHaveAttribute('aria-label', 'Testeroth - HP 8/12, Seviye 3');
  });
});
