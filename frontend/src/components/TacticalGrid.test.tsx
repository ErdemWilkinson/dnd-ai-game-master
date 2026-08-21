import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TacticalGrid } from './TacticalGrid';
import * as api from '../api';

vi.mock('../api');

function sceneWith(activeTokenId: string) {
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
      { id: 'player', type: 'player' as const, name: 'Sen', x: 0, y: 0, speed: 3 },
      { id: 'goblin-1', type: 'enemy' as const, name: 'Goblin', x: 1, y: 0, speed: 3 },
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
    render(<TacticalGrid />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]);

    expect(api.moveToken).toHaveBeenCalled();
  });

  it('sıra düşmandayken hücreye tıklamak moveToken\'ı ÇAĞIRMAZ ve uyarı gösterir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('goblin-1'));

    const user = userEvent.setup();
    render(<TacticalGrid />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());
    expect(screen.getByText(/senin sıran değil/i)).toBeInTheDocument();

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]);

    expect(api.moveToken).not.toHaveBeenCalled();
    expect(screen.getByText('Sıra sende değil.')).toBeInTheDocument();
  });

  it('sıra düşmandayken grid görsel olarak devre dışı sınıfı alır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('goblin-1'));
    render(<TacticalGrid />);
    await waitFor(() => expect(document.querySelector('.grid')).toBeInTheDocument());
    expect(document.querySelector('.grid')).toHaveClass('grid-disabled');
  });
});
