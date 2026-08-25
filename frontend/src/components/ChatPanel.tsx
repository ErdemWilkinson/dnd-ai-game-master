import { useEffect, useRef, useState } from 'react';
import { getChatHistory, sendChatMessage } from '../api';
import type { ActionRoll, ChatMessage } from '../types';

const ATTR_LABELS_TR: Record<ActionRoll['attribute'], string> = {
  str: 'Güç',
  dex: 'Çeviklik',
  con: 'Dayanıklılık',
  int: 'Zeka',
  wis: 'Bilgelik',
  cha: 'Karizma',
};

const OUTCOME_LABELS_TR: Record<ActionRoll['outcome'], string> = {
  'critical-success': 'Büyük Başarı',
  success: 'Başarılı',
  failure: 'Başarısız',
  'critical-failure': 'Büyük Başarısızlık',
};

interface Props {
  refreshKey?: number;
}

export function ChatPanel({ refreshKey = 0 }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatHistory().then(({ messages }) => setMessages(messages));
  }, [refreshKey]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const { playerMessage, gmMessage } = await sendChatMessage(text);
      setMessages((prev) => [...prev, playerMessage, gmMessage]);
      // Yaratıcı cron fikir #37: input eskiden istek başlamadan ÖNCE
      // boşaltılıyordu - istek başarısız olursa (ör. #36'nın rate-limit'i)
      // hem mesaj hiçbir yere eklenmiyor hem kullanıcı yazdığını kaybediyordu,
      // ekranda hiçbir hata da görünmüyordu. Artık input SADECE başarı
      // durumunda temizleniyor, hata durumunda olduğu gibi kalıyor.
      setInput('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-panel">
      <h3>Macera Günlüğü</h3>
      <div className="chat-messages" ref={messagesRef}>
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.role}`}>
            <span className="chat-role">
              {m.role === 'gm' ? 'GM' : 'Sen'}
              {m.source === 'mock' && <span className="chat-source-tag"> (mock)</span>}
            </span>
            <p>
              {m.text}
              {m.role === 'gm' && m.roll && (
                <span
                  className={`roll-badge roll-${m.roll.outcome}`}
                  title={`${ATTR_LABELS_TR[m.roll.attribute]} kontrolü: ${m.roll.roll}+${m.roll.modifier}=${m.roll.total} (DC ${m.roll.dc})`}
                >
                  {OUTCOME_LABELS_TR[m.roll.outcome]}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ne yapmak istersin?"
          disabled={sending}
        />
        <button type="submit" disabled={sending}>
          Gönder
        </button>
      </form>
    </div>
  );
}
