import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntroScreen } from './IntroScreen';

// Yaratıcı cron fikir #102: IntroScreen.tsx hiç test dosyasına sahip değildi
// (HeaderHud.tsx'in #101'de düzeltilen aynı boşluğu). HeaderHud.test.tsx'teki
// desenle aynı yaklaşım.
describe('IntroScreen — İnovasyon fikri #102', () => {
  it('açılış metnini gösterir', () => {
    render(<IntroScreen text="Karanlık bir mahzende uyanıyorsun." source="ai" onContinue={() => {}} />);
    expect(screen.getByText('Karanlık bir mahzende uyanıyorsun.')).toBeInTheDocument();
  });

  it('source==="ai" iken "(mock anlatım)" etiketi görünmez', () => {
    render(<IntroScreen text="Gerçek AI anlatımı." source="ai" onContinue={() => {}} />);
    expect(screen.queryByText('(mock anlatım)')).not.toBeInTheDocument();
  });

  it('source==="mock" iken "(mock anlatım)" etiketi görünür', () => {
    render(<IntroScreen text="Mock anlatım." source="mock" onContinue={() => {}} />);
    expect(screen.getByText('(mock anlatım)')).toBeInTheDocument();
  });

  it('"Devam Et" butonuna tıklanınca onContinue çağrılır', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(<IntroScreen text="Macera başlıyor." source="ai" onContinue={onContinue} />);
    await user.click(screen.getByRole('button', { name: 'Devam Et' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
