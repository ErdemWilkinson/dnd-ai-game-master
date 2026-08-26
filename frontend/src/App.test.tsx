import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as api from './api';
import type { Character } from './types';

vi.mock('./api');

const CHARACTER: Character = {
  id: 'c1',
  name: 'Kalıcı Kahraman',
  race: 'human',
  class: 'fighter',
  appearance: null,
  level: 1,
  xp: 0,
  hp: { current: 12, max: 12 },
  mana: { current: 0, max: 0 },
  attributes: { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 },
  inventory: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  // TacticalGrid ve ChatPanel de mount olacağı için ilgili API çağrılarını da mock'luyoruz.
  vi.mocked(api.getScene).mockResolvedValue({
    id: 's1', name: 'Sahne', width: 1, height: 1, round: 1, activeTokenId: 'player',
    obstacles: [], loot: [], tokens: [{ id: 'player', type: 'player', name: 'Sen', x: 0, y: 0, speed: 1 }],
  } as never);
  vi.mocked(api.getChatHistory).mockResolvedValue({ messages: [] });
  // Karakter yoksa CharacterCreation mount olur, o da bunu çağırır.
  vi.mocked(api.getCharacterOptions).mockResolvedValue({ races: [], classes: [], appearances: [] });
});

describe('App — Bug #4: sayfa yenilenince aktif karakter geri yüklenmeli', () => {
  it('backend\'de aktif karakter varsa açılışta doğrudan oyun ekranını gösterir (oluşturma formuna dönmez)', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    render(<App />);

    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    expect(screen.queryByText('Karakter Oluştur')).not.toBeInTheDocument();
  });

  it('backend\'de aktif karakter yoksa (404/hata) karakter oluşturma formunu gösterir', async () => {
    vi.mocked(api.getCurrentCharacter).mockRejectedValue(new Error('Aktif karakter yok.'));
    render(<App />);

    await waitFor(() => expect(screen.getByText('Karakter Oluştur')).toBeInTheDocument());
  });
});

describe('App — Faz 3-A: oluşturma -> açılış hikayesi -> oyun akışı', () => {
  it('karakter oluşturulduktan sonra önce IntroScreen gösterilir, "Devam Et" ile oyun ekranına geçilir', async () => {
    vi.mocked(api.getCurrentCharacter).mockRejectedValue(new Error('Aktif karakter yok.'));
    vi.mocked(api.getCharacterOptions).mockResolvedValue({
      races: [{ id: 'human', name: 'İnsan', attributeBonuses: {} }],
      classes: [{ id: 'fighter', name: 'Savaşçı', baseHp: 12, baseMana: 0, primaryAttribute: 'str', startingInventory: [] }],
      appearances: [{ id: 'scarred-veteran', name: 'Yara İzli Gazi', description: '...' }],
    });
    const rolledAttributes = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };
    vi.mocked(api.rollStats).mockResolvedValue({ rolls: rolledAttributes, attributes: rolledAttributes });
    vi.mocked(api.createCharacter).mockResolvedValue(CHARACTER);
    vi.mocked(api.getCharacterIntro).mockResolvedValue({ text: 'Gözlerini karanlıkta açıyorsun.', source: 'ai' });

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByText('Karakter Oluştur')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Kalıcı Kahraman');
    await user.click(screen.getByRole('button', { name: /Zar At/i }));
    // ROLL_ANIMATION_MS=700ms'lik gerçek zamanlı animasyon süresini bekliyoruz.
    await new Promise((resolve) => setTimeout(resolve, 800));
    await waitFor(() => expect(screen.getByRole('button', { name: /Maceraya Başla/i })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    await waitFor(() => expect(screen.getByText('Macera Başlıyor')).toBeInTheDocument());
    expect(screen.getByText('Gözlerini karanlıkta açıyorsun.')).toBeInTheDocument();
    expect(screen.queryByText('Kalıcı Kahraman')).not.toBeInTheDocument(); // oyun ekranı henüz gösterilmiyor

    await user.click(screen.getByRole('button', { name: /Devam Et/i }));

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    expect(screen.queryByText('Macera Başlıyor')).not.toBeInTheDocument();
  });
});

describe('App — Faz 6-C: Game Over ve Yeniden Başla', () => {
  it('character.hp.current<=0 olunca oyun ekranı yerine GameOverScreen gösterilir', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue({ ...CHARACTER, hp: { current: 0, max: 12 } });
    render(<App />);

    await waitFor(() => expect(screen.getByText('Oyun Bitti')).toBeInTheDocument());
    expect(screen.queryByText('D&D AI Game Master')).not.toBeInTheDocument();
  });

  it('"Yeniden Başla" resetSession\'ı çağırır ve karakter oluşturma ekranına döner', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue({ ...CHARACTER, hp: { current: 0, max: 12 } });
    vi.mocked(api.resetSession).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Oyun Bitti')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Yeniden Başla' }));

    expect(api.resetSession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Karakter Oluştur')).toBeInTheDocument());
  });

  it('character.hp.current>0 iken GameOverScreen gösterilmez, normal oyun ekranı çalışmaya devam eder (regresyon)', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    expect(screen.queryByText('Oyun Bitti')).not.toBeInTheDocument();
  });
});

describe('App — İnovasyon fikri #80: footer atıf linki tıklanabilir olmalı', () => {
  it('tgstation atıf metni gerçek bir <a> linki içerir, doğru href/target/rel ile', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());

    const link = screen.getByRole('link', { name: 'github.com/tgstation/tgstation' });
    expect(link).toHaveAttribute('href', 'https://github.com/tgstation/tgstation');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
