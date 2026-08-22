import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TacticalGrid } from './TacticalGrid';
import * as api from '../api';

vi.mock('../api');

function sceneWith(
  activeTokenId: string,
  tokenOverrides: { actionAvailable?: boolean; bonusActionAvailable?: boolean; movementLeft?: number } = {},
) {
  return {
    id: 's1',
    name: 'Test Sahnesi',
    width: 2,
    height: 1,
    round: 1,
    activeTokenId,
    obstacles: [],
    loot: [],
    tokens: [
      {
        id: 'player',
        type: 'player' as const,
        name: 'Sen',
        x: 0,
        y: 0,
        speed: 3,
        movementLeft: 3,
        actionAvailable: true,
        bonusActionAvailable: true,
        ...tokenOverrides,
      },
      {
        id: 'goblin-1',
        type: 'enemy' as const,
        name: 'Goblin',
        x: 1,
        y: 0,
        speed: 3,
        movementLeft: 3,
        actionAvailable: true,
        bonusActionAvailable: true,
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TacticalGrid — Bug #5: düşman sırasındayken grid tıklaması engellenmeli', () => {
  it('sıra oyuncudayken hücreye tıklamak moveToken çağırır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    vi.mocked(api.moveToken).mockResolvedValue({ scene: sceneWith('player'), collectedLoot: null });

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]);

    expect(api.moveToken).toHaveBeenCalled();
  });

  it('sıra düşmandayken hücreye tıklamak moveToken\'ı ÇAĞIRMAZ ve uyarı gösterir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('goblin-1'));

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());
    expect(screen.getByText(/senin sıran değil/i)).toBeInTheDocument();

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]);

    expect(api.moveToken).not.toHaveBeenCalled();
    expect(screen.getByText('Sıra sende değil.')).toBeInTheDocument();
  });

  it('sıra düşmandayken grid görsel olarak devre dışı sınıfı alır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('goblin-1'));
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(document.querySelector('.grid')).toBeInTheDocument());
    expect(document.querySelector('.grid')).toHaveClass('grid-disabled');
  });
});

describe('TacticalGrid — Faz 3-E: fırlatma hedefi grid üzerinden seçiliyor', () => {
  it('throwingItemId varken hücreye tıklamak moveToken değil throwItem çağırır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    vi.mocked(api.throwItem).mockResolvedValue({
      character: { id: 'char-1' } as never,
      scene: sceneWith('player'),
    });

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" throwingItemId="item-1" />);
    await waitFor(() => expect(screen.getByText('Fırlatma hedefi seç')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[1]); // (x=1, y=0)

    expect(api.throwItem).toHaveBeenCalledWith('char-1', 'item-1', 1, 0);
    expect(api.moveToken).not.toHaveBeenCalled();
  });

  it('fırlatma modunda grid, sıra düşmanda olsa bile devre dışı BIRAKILMAZ (throw her zaman aktif)', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('goblin-1'));
    render(<TacticalGrid characterId="char-1" throwingItemId="item-1" />);
    await waitFor(() => expect(document.querySelector('.grid')).toBeInTheDocument());
    expect(document.querySelector('.grid')).not.toHaveClass('grid-disabled');
    expect(document.querySelector('.grid')).toHaveClass('grid-throw-mode');
  });

  it('fırlatma başarılı olunca onThrowComplete güncellenmiş karakterle çağrılır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    const updatedCharacter = { id: 'char-1', name: 'Güncellendi' } as never;
    vi.mocked(api.throwItem).mockResolvedValue({ character: updatedCharacter, scene: sceneWith('player') });
    const onThrowComplete = vi.fn();

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" throwingItemId="item-1" onThrowComplete={onThrowComplete} />);
    await waitFor(() => expect(screen.getByText('Fırlatma hedefi seç')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]);

    await waitFor(() => expect(onThrowComplete).toHaveBeenCalledWith(updatedCharacter));
  });

  it('throwingItemId yokken normal hareket modu çalışmaya devam eder (regresyon)', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    vi.mocked(api.moveToken).mockResolvedValue({ scene: sceneWith('player'), collectedLoot: null });

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" throwingItemId={null} />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]);

    expect(api.moveToken).toHaveBeenCalled();
    expect(api.throwItem).not.toHaveBeenCalled();
  });
});

describe('TacticalGrid — Faz 3-C: Aksiyon ekonomisi göstergesi', () => {
  it('oyuncunun Aksiyon/Bonus Aksiyon durumunu ✓ olarak gösterir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(
      sceneWith('player', { actionAvailable: true, bonusActionAvailable: true }),
    );
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText(/Aksiyon:/)).toBeInTheDocument());
    expect(screen.getByText('Aksiyon: ✓ · Bonus: ✓')).toBeInTheDocument();
  });

  it('Aksiyon tükenmişse ✗ olarak gösterir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(
      sceneWith('player', { actionAvailable: false, bonusActionAvailable: true }),
    );
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText(/Aksiyon:/)).toBeInTheDocument());
    expect(screen.getByText('Aksiyon: ✗ · Bonus: ✓')).toBeInTheDocument();
  });
});

describe('TacticalGrid — Faz 4 Bug B: hareket ekonomisi göstergesi', () => {
  it('oyuncunun kalan/maks hareket hakkını gösterir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player', { movementLeft: 2 }));
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText(/Hareket:/)).toBeInTheDocument());
    expect(screen.getByText('Hareket: 2/3')).toBeInTheDocument();
  });

  it('hareket hakkı tükenince 0/max gösterir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player', { movementLeft: 0 }));
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText(/Hareket:/)).toBeInTheDocument());
    expect(screen.getByText('Hareket: 0/3')).toBeInTheDocument();
  });
});
