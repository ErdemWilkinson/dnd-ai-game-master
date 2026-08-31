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
const APPEARANCES = [
  { id: 'scarred-veteran', name: 'Yara İzli Gazi', description: 'Yüzünde eski savaşlardan izler.' },
];
const ROLLED_ATTRIBUTES = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };

// Bileşen zar animasyonunu gerçek zamanlayıcılarla (window.setInterval/setTimeout,
// ROLL_ANIMATION_MS=700ms) çalıştırıyor; testte de gerçek zamanı bu kadar bekliyoruz.
const ROLL_ANIMATION_MS = 700;

async function rollDice(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Zar At \(D20\)/i }));
  await new Promise((resolve) => setTimeout(resolve, ROLL_ANIMATION_MS + 100));
  await waitFor(() => expect(screen.getByRole('button', { name: /Maceraya Başla/i })).not.toBeDisabled());
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getCharacterOptions).mockResolvedValue({ races: RACES, classes: CLASSES, appearances: APPEARANCES });
  vi.mocked(api.rollStats).mockResolvedValue({ rolls: ROLLED_ATTRIBUTES, attributes: ROLLED_ATTRIBUTES });
});

describe('CharacterCreation', () => {
  it('ırk, sınıf ve dış görünüş seçeneklerini yükler ve gösterir', async () => {
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());
    expect(screen.getByText('Savaşçı')).toBeInTheDocument();
    expect(screen.getByText('Yara İzli Gazi')).toBeInTheDocument();
  });

  it('isim girmeden gönderilirse hata gösterir ve API çağrılmaz', async () => {
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    // Zar atılmadan submit butonu zaten disabled, ama isim boşken bu kontrol
    // daha önce devreye girmeli — zar atıp submit'in aktif olmasını sağlıyoruz.
    await rollDice(user);
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    expect(screen.getByText('İsim gerekli.')).toBeInTheDocument();
    expect(api.createCharacter).not.toHaveBeenCalled();
  });

  it('zar atılmadan submit butonu disabled kalır', async () => {
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Aragorn');

    expect(screen.getByRole('button', { name: /Maceraya Başla/i })).toBeDisabled();
    expect(api.createCharacter).not.toHaveBeenCalled();
  });

  it('zar atınca D20 sonuçları ekranda gösterilir ve rollStats doğru raceId ile çağrılır', async () => {
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await rollDice(user);

    expect(api.rollStats).toHaveBeenCalledWith('human'); // ilk ırk varsayılan seçili
    // Nihai (sabit) zar sonuçları ekranda görünmeli
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  it('ırk değiştirilince önceki zar sonucu sıfırlanır, submit tekrar disabled olur', async () => {
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await rollDice(user);
    expect(screen.getByRole('button', { name: /Maceraya Başla/i })).not.toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Irk'), 'elf');

    expect(screen.getByRole('button', { name: /Maceraya Başla/i })).toBeDisabled();
  });

  it('geçerli isim + zar sonrası gönderilince createCharacter ve getCharacterIntro çağrılır, onCreated tetiklenir', async () => {
    const onCreated = vi.fn();
    const fakeCharacter = { id: 'x1', name: 'Aragorn' };
    const fakeIntro = { text: 'Açılış hikayesi.', source: 'ai' as const };
    vi.mocked(api.createCharacter).mockResolvedValue(fakeCharacter as never);
    vi.mocked(api.getCharacterIntro).mockResolvedValue(fakeIntro);

    const user = userEvent.setup();
    render(<CharacterCreation onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Aragorn');
    await rollDice(user);
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(fakeCharacter, fakeIntro));
    expect(api.createCharacter).toHaveBeenCalledWith('Aragorn', 'human', 'fighter', 'scarred-veteran', ROLLED_ATTRIBUTES);
    expect(api.getCharacterIntro).toHaveBeenCalledWith('x1');
  });

  it('createCharacter hata döndürürse hata mesajını gösterir, getCharacterIntro çağrılmaz', async () => {
    vi.mocked(api.createCharacter).mockRejectedValue(new Error('Sunucu hatası'));
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Test');
    await rollDice(user);
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    await waitFor(() => expect(screen.getByText('Sunucu hatası')).toBeInTheDocument());
    expect(api.getCharacterIntro).not.toHaveBeenCalled();
  });

  it('İnovasyon fikri #104: hata mesajı aria-live="polite" ile duyurulur (fikir #86/#103 ile aynı bug sınıfı)', async () => {
    vi.mocked(api.createCharacter).mockRejectedValue(new Error('Sunucu hatası'));
    const user = userEvent.setup();
    render(<CharacterCreation onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('İnsan')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Test');
    await rollDice(user);
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    await waitFor(() => expect(screen.getByText('Sunucu hatası')).toBeInTheDocument());
    expect(screen.getByText('Sunucu hatası')).toHaveAttribute('aria-live', 'polite');
  });
});
