import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('Faz 3-D: gm mesajının roll alanı varsa zar özeti gösterilir', async () => {
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
    await waitFor(() => expect(screen.getByText('Saldırın hedefi buluyor.')).toBeInTheDocument());
    expect(screen.getByText(/Güç kontrolü: 14\+2=16 \(DC 12\)/)).toBeInTheDocument();
    expect(screen.getByText(/Başarılı/)).toBeInTheDocument();
  });

  it('roll alanı olmayan (ör. player) mesajlarda zar özeti gösterilmez', async () => {
    vi.mocked(api.getChatHistory).mockResolvedValue({
      messages: [{ id: 'p1', role: 'player', text: 'merhaba', timestamp: 1 }],
    });

    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText('merhaba')).toBeInTheDocument());
    expect(screen.queryByText(/kontrolü:/)).not.toBeInTheDocument();
  });

  it('boş mesaj gönderilemez', async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await waitFor(() => expect(api.getChatHistory).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(api.sendChatMessage).not.toHaveBeenCalled();
  });
});
