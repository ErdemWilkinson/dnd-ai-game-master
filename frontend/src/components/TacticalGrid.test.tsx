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
    encounterIndex: 0,
    totalEncounters: 4,
    pendingEncounterIndex: null,
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
    vi.mocked(api.moveToken).mockResolvedValue({ scene: sceneWith('player'), collectedLoot: null, inventoryFull: false, narration: null, character: null });

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
    vi.mocked(api.moveToken).mockResolvedValue({ scene: sceneWith('player'), collectedLoot: null, inventoryFull: false, narration: null, character: null });

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

describe('TacticalGrid — Faz 5 madde 1: bitişik düşmana tıkla-saldır', () => {
  it('bitişik bir düşman token\'ına tıklamak attackTarget çağırır, moveToken çağırmaz', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player')); // player (0,0), goblin (1,0) - bitişik
    vi.mocked(api.attackTarget).mockResolvedValue({
      character: { id: 'char-1' } as never,
      scene: sceneWith('player'),
      attackResult: { attribute: 'str', roll: 15, modifier: 2, total: 17, dc: 12, outcome: 'success' },
      damage: 5,
      defeated: false,
      levelsGained: 0,
      narration: { text: 'Vurdun!', source: 'mock' },
    });

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[1]); // goblin'in bulunduğu (1,0) hücresi

    expect(api.attackTarget).toHaveBeenCalledWith('char-1', 'goblin-1');
    expect(api.moveToken).not.toHaveBeenCalled();
  });

  it('saldırı sonrası onCharacterChange ve onChatActivity çağrılır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    const updatedCharacter = { id: 'char-1', name: 'Güncellendi' } as never;
    vi.mocked(api.attackTarget).mockResolvedValue({
      character: updatedCharacter,
      scene: sceneWith('player'),
      attackResult: { attribute: 'str', roll: 15, modifier: 2, total: 17, dc: 12, outcome: 'success' },
      damage: 5,
      defeated: false,
      levelsGained: 0,
      narration: { text: 'Vurdun!', source: 'mock' },
    });
    const onCharacterChange = vi.fn();
    const onChatActivity = vi.fn();

    const user = userEvent.setup();
    render(
      <TacticalGrid
        characterId="char-1"
        onCharacterChange={onCharacterChange}
        onChatActivity={onChatActivity}
      />,
    );
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[1]);

    await waitFor(() => expect(onCharacterChange).toHaveBeenCalledWith(updatedCharacter));
    expect(onChatActivity).toHaveBeenCalledTimes(1);
  });

  it('boş/hareket hedefi bir hücreye tıklamak hâlâ moveToken çağırır (regresyon)', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    vi.mocked(api.moveToken).mockResolvedValue({ scene: sceneWith('player'), collectedLoot: null, inventoryFull: false, narration: null, character: null });

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    // 2 genişlikli sahnede player (0,0), goblin (1,0) - player'ın kendi hücresine tıklamak (boş bir hedef değil ama düşman değil)
    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]); // (0,0) - player'ın kendi hücresi, düşman değil

    expect(api.moveToken).toHaveBeenCalled();
    expect(api.attackTarget).not.toHaveBeenCalled();
  });

  it('sıra oyuncudayken saldırı ipucu metni gösterilir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText(/bitişik bir düşmana tıklayarak/i)).toBeInTheDocument());
  });

  it('fırlatma modundayken saldırı ipucu metni gösterilmez', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    render(<TacticalGrid characterId="char-1" throwingItemId="item-1" />);
    await waitFor(() => expect(screen.getByText('Fırlatma hedefi seç')).toBeInTheDocument());
    expect(screen.queryByText(/bitişik bir düşmana tıklayarak/i)).not.toBeInTheDocument();
  });

  it('token tooltip\'i HP bilgisini gösterir', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    // sceneWith() varsayılan token'larda hp/maxHp içermiyor, bu durumda tooltip sade isim olmalı
    expect(cells[1].getAttribute('title')).toBe('Goblin');
  });
});

describe('TacticalGrid — Faz 6-C: büyü hedefi grid üzerinden seçiliyor', () => {
  it('castingSpellId varken düşman token\'ına tıklamak attackTarget değil castSpell çağırır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    vi.mocked(api.castSpell).mockResolvedValue({
      character: { id: 'char-1' } as never,
      scene: sceneWith('player'),
      spell: 'fireball',
      narration: { text: 'Ateş!', source: 'mock' },
    });

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" castingSpellId="fireball" />);
    await waitFor(() => expect(screen.getByText('Büyü hedefi seç')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[1]); // goblin'in bulunduğu (1,0) hücresi

    expect(api.castSpell).toHaveBeenCalledWith('char-1', 'fireball', 'goblin-1');
    expect(api.attackTarget).not.toHaveBeenCalled();
  });

  it('büyü modunda boş bir hücreye tıklamak castSpell\'i ÇAĞIRMAZ (sadece düşman hücreleri hedeflenebilir)', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" castingSpellId="fireball" />);
    await waitFor(() => expect(screen.getByText('Büyü hedefi seç')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[0]); // player'ın kendi hücresi, boş/düşman değil

    expect(api.castSpell).not.toHaveBeenCalled();
    expect(api.moveToken).not.toHaveBeenCalled();
  });

  it('büyü modunda grid, sıra düşmanda olsa bile devre dışı bırakılmaz', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('goblin-1'));
    render(<TacticalGrid characterId="char-1" castingSpellId="fireball" />);
    await waitFor(() => expect(document.querySelector('.grid')).toBeInTheDocument());
    expect(document.querySelector('.grid')).not.toHaveClass('grid-disabled');
  });

  it('büyü başarılı olunca onCastComplete ve onChatActivity çağrılır', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    const updatedCharacter = { id: 'char-1', name: 'Güncellendi' } as never;
    vi.mocked(api.castSpell).mockResolvedValue({
      character: updatedCharacter,
      scene: sceneWith('player'),
      spell: 'fireball',
      narration: { text: 'Ateş!', source: 'mock' },
    });
    const onCastComplete = vi.fn();
    const onChatActivity = vi.fn();

    const user = userEvent.setup();
    render(
      <TacticalGrid
        characterId="char-1"
        castingSpellId="fireball"
        onCastComplete={onCastComplete}
        onChatActivity={onChatActivity}
      />,
    );
    await waitFor(() => expect(screen.getByText('Büyü hedefi seç')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[1]);

    await waitFor(() => expect(onCastComplete).toHaveBeenCalledWith(updatedCharacter));
    expect(onChatActivity).toHaveBeenCalledTimes(1);
  });

  it('castingSpellId yokken normal saldırı/hareket akışı çalışmaya devam eder (regresyon)', async () => {
    vi.mocked(api.getScene).mockResolvedValue(sceneWith('player'));
    vi.mocked(api.attackTarget).mockResolvedValue({
      character: { id: 'char-1' } as never,
      scene: sceneWith('player'),
      attackResult: { attribute: 'str', roll: 15, modifier: 2, total: 17, dc: 12, outcome: 'success' },
      damage: 5,
      defeated: false,
      levelsGained: 0,
      narration: { text: 'Vurdun!', source: 'mock' },
    });

    const user = userEvent.setup();
    render(<TacticalGrid characterId="char-1" castingSpellId={null} />);
    await waitFor(() => expect(screen.getByText('Test Sahnesi')).toBeInTheDocument());

    const cells = document.querySelectorAll('.grid .cell');
    await user.click(cells[1]);

    expect(api.attackTarget).toHaveBeenCalledWith('char-1', 'goblin-1');
    expect(api.castSpell).not.toHaveBeenCalled();
  });
});

describe('TacticalGrid — Faz 7-A: karşılaşma ilerleme göstergesi', () => {
  it('"Karşılaşma: N/M" 1 tabanlı (encounterIndex+1) olarak gösterilir', async () => {
    const scene = sceneWith('player');
    scene.encounterIndex = 0;
    scene.totalEncounters = 4;
    vi.mocked(api.getScene).mockResolvedValue(scene);
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText('Karşılaşma: 1/4')).toBeInTheDocument());
  });

  it('ikinci karşılaşmadayken göstergeyi doğru günceller', async () => {
    const scene = sceneWith('player');
    scene.encounterIndex = 1;
    scene.totalEncounters = 4;
    vi.mocked(api.getScene).mockResolvedValue(scene);
    render(<TacticalGrid characterId="char-1" />);
    await waitFor(() => expect(screen.getByText('Karşılaşma: 2/4')).toBeInTheDocument());
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
