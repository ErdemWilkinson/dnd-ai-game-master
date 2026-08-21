import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import * as api from './api';

vi.mock('./api');

const CHARACTER = {
  id: 'c1',
  name: 'Kalıcı Kahraman',
  race: 'human',
  class: 'fighter',
  level: 1,
  hp: { current: 12, max: 12 },
  mana: { current: 0, max: 0 },
  attributes: { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 },
  inventory: [],
} as never;

beforeEach(() => {
  vi.resetAllMocks();
  // TacticalGrid ve ChatPanel de mount olacağı için ilgili API çağrılarını da mock'luyoruz.
  vi.mocked(api.getScene).mockResolvedValue({
    id: 's1', name: 'Sahne', width: 1, height: 1, round: 1, activeTokenId: 'player',
    obstacles: [], loot: [], tokens: [{ id: 'player', type: 'player', name: 'Sen', x: 0, y: 0, speed: 1 }],
  } as never);
  vi.mocked(api.getChatHistory).mockResolvedValue({ messages: [] });
  // Karakter yoksa CharacterCreation mount olur, o da bunu çağırır.
  vi.mocked(api.getCharacterOptions).mockResolvedValue({ races: [], classes: [] });
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
