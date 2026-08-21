import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterCreation } from './CharacterCreation';
import * as api from '../api';

vi.mock('../api');

const RACES = [
  { id: 'human', name: 'İnsan', attributeBonuses: {} },
  { id: 'elf', name: 'Elf', attributeBonuses: {} },
];
const CLASSES = [
  { id: 'fighter', name: 'Savaşçı', baseHp: 12, baseMana: 0, primaryAttribute: 'str' as const, startingInventory: [] },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getCharacterOptions).mockResolvedValue({ races: RACES, classes: CLASSES });
});

describe('CharacterCreation', () => {
  it('ırk ve sınıf seçeneklerini yükler ve gösterir', async () => {
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());
    expect(screen.getByText('Savaşçı')).toBeInTheDocument();
  });

  it('isim girmeden gönderilirse hata gösterir ve API çağrılmaz', async () => {
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    expect(screen.getByText('İsim gerekli.')).toBeInTheDocument();
    expect(api.createCharacter).not.toHaveBeenCalled();
  });

  it('geçerli isimle gönderilince createCharacter çağrılır ve onCreated tetiklenir', async () => {
    const onCreated = vi.fn();
    const fakeCharacter = { id: 'x1', name: 'Aragorn' };
    vi.mocked(api.createCharacter).mockResolvedValue(fakeCharacter as never);

    const user = userEvent.setup();
    render(<CharacterCreation onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Aragorn');
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(fakeCharacter));
    expect(api.createCharacter).toHaveBeenCalledWith('Aragorn', 'human', 'fighter');
  });

  it('API hata döndürürse hata mesajını gösterir', async () => {
    vi.mocked(api.createCharacter).mockRejectedValue(new Error('Sunucu hatası'));
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Test');
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    await waitFor(() => expect(screen.getByText('Sunucu hatası')).toBeInTheDocument());
  });
});
