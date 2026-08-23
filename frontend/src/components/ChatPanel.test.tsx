import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from './ChatPanel';
import * as api from '../api';

vi.mock('../api');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getChatHistory).mockResolvedValue({ messages: [] });
});

describe('ChatPanel', () => {
  it('mesaj gönderince player + gm mesajlarını gösterir', async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValue({
      playerMessage: { id: 'p1', role: 'player', text: 'etrafa bak', timestamp: 1 },
      gmMessage: { id: 'g1', role: 'gm', text: 'Karanlık bir koridor.', source: 'ai', timestamp: 2 },
    });

    const user = userEvent.setup();
    render(<ChatPanel />);
    await waitFor(() => expect(api.getChatHistory).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('Ne yapmak istersin?'), 'etrafa bak');
    await user.click(screen.getByRole('button', { name: 'Gönder' }));

    await waitFor(() => expect(screen.getByText('Karanlık bir koridor.')).toBeInTheDocument());
    expect(screen.getByText('etrafa bak')).toBeInTheDocument();
  });

  it('source "mock" olan mesajlarda "(mock)" etiketi gösterir, "ai" olanlarda göstermez', async () => {
    vi.mocked(api.getChatHistory).mockResolvedValue({
      messages: [
        { id: 'g1', role: 'gm', text: 'AI cevabı.', source: 'ai', timestamp: 1 },
        { id: 'g2', role: 'gm', text: 'Mock cevabı.', source: 'mock', timestamp: 2 },
      ],
    });

    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText('AI cevabı.')).toBeInTheDocument());

    expect(screen.getByText('Mock cevabı.').closest('.chat-message')).toHaveTextContent('(mock)');
    expect(screen.getByText('AI cevabı.').closest('.chat-message')).not.toHaveTextContent('(mock)');
  });

  it("Faz 8: gm mesajının roll alanı varsa ham zar matematiği ANA metinde görünmez, sadece küçük bir sonuç rozeti + tooltip'te durur", async () => {
    vi.mocked(api.getChatHistory).mockResolvedValue({
      messages: [
        {
          id: 'g1',
          role: 'gm',
          text: 'Saldırın hedefi buluyor.',
          source: 'mock',
          timestamp: 1,
          roll: { attribute: 'str', roll: 14, modifier: 2, total: 16, dc: 12, outcome: 'success' },
        },
      ],
    });

    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByTitle(/kontrolü/)).toBeInTheDocument());

    const message = screen.getByTitle(/kontrolü/).closest('.chat-message') as HTMLElement;
    expect(message).toHaveTextContent('Saldırın hedefi buluyor.');
    // Ham zar matematiği ana metinde/gövdede DEĞİL, sadece tooltip (title attribute) içinde olmalı
    expect(message.textContent).not.toMatch(/14\+2=16/);
    expect(screen.getByTitle('Güç kontrolü: 14+2=16 (DC 12)')).toBeInTheDocument();

    const badge = within(message).getByText('Başarılı');
    expect(badge).toHaveClass('roll-badge', 'roll-success');
  });

  it('roll alanı olmayan (ör. player) mesajlarda zar özeti gösterilmez', async () => {
    vi.mocked(api.getChatHistory).mockResolvedValue({
      messages: [{ id: 'p1', role: 'player', text: 'merhaba', timestamp: 1 }],
    });

    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText('merhaba')).toBeInTheDocument());
    expect(screen.queryByText(/kontrolü:/)).not.toBeInTheDocument();
  });

  it('Faz 8: yeni mesaj gelince sadece .chat-messages container kaydırılır (scrollIntoView kullanılmaz, sayfa/body etkilenmez)', async () => {
    vi.mocked(api.getChatHistory).mockResolvedValue({
      messages: [{ id: 'p1', role: 'player', text: 'ilk mesaj', timestamp: 1 }],
    });
    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText('ilk mesaj')).toBeInTheDocument());

    const container = document.querySelector('.chat-messages') as HTMLElement;
    Object.defineProperty(container, 'scrollHeight', { value: 999, configurable: true });
    container.scrollTop = 0;

    // yeni mesaj eklenmesini simüle et (aynı ref'in effect'i tetiklenir)
    vi.mocked(api.getChatHistory).mockResolvedValue({
      messages: [
        { id: 'p1', role: 'player', text: 'ilk mesaj', timestamp: 1 },
        { id: 'p2', role: 'player', text: 'ikinci mesaj', timestamp: 2 },
      ],
    });
    const user = userEvent.setup();
    vi.mocked(api.sendChatMessage).mockResolvedValue({
      playerMessage: { id: 'p2', role: 'player', text: 'ikinci mesaj', timestamp: 2 },
      gmMessage: { id: 'g2', role: 'gm', text: 'cevap', source: 'mock', timestamp: 3 },
    });
    await user.type(screen.getByPlaceholderText('Ne yapmak istersin?'), 'ikinci mesaj');
    await user.click(screen.getByRole('button', { name: 'Gönder' }));

    await waitFor(() => expect(screen.getByText('cevap')).toBeInTheDocument());
    // container kendi içinde en alta kaydı
    expect(container.scrollTop).toBe(999);
  });

  it('boş mesaj gönderilemez', async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await waitFor(() => expect(api.getChatHistory).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(api.sendChatMessage).not.toHaveBeenCalled();
  });
});
