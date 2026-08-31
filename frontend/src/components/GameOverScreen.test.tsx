import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameOverScreen } from './GameOverScreen';

describe('GameOverScreen — Faz 6-C', () => {
  it('karakter adını ve seviyesini gösterir', () => {
    render(<GameOverScreen characterName="Testeroth" level={3} onRestart={() => {}} />);
    expect(screen.getByText('Oyun Bitti')).toBeInTheDocument();
    expect(screen.getByText(/Testeroth/)).toBeInTheDocument();
    expect(screen.getByText(/seviye 3/)).toBeInTheDocument();
  });

  it('"Yeniden Başla" tıklanınca onRestart çağrılır', async () => {
    const onRestart = vi.fn();
    const user = userEvent.setup();
    render(<GameOverScreen characterName="Testeroth" level={1} onRestart={onRestart} />);

    await user.click(screen.getByRole('button', { name: 'Yeniden Başla' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('İnovasyon fikri #86: restartError mesajı aria-live="polite" ile duyurulur', () => {
    render(
      <GameOverScreen
        characterName="Testeroth"
        level={1}
        onRestart={() => {}}
        restartError="Bir hata oluştu."
      />,
    );
    const errorEl = screen.getByText(/Bir hata oluştu\./);
    expect(errorEl).toHaveAttribute('aria-live', 'polite');
  });

  it('İnovasyon fikri #105: ekran açılınca "Yeniden Başla" butonuna otomatik focus verilir', () => {
    render(<GameOverScreen characterName="Testeroth" level={1} onRestart={() => {}} />);
    expect(screen.getByRole('button', { name: 'Yeniden Başla' })).toHaveFocus();
  });
});
