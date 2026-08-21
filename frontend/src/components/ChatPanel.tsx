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

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatHistory().then(({ messages }) => setMessages(messages));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      const { playerMessage, gmMessage } = await sendChatMessage(text);
      setMessages((prev) => [...prev, playerMessage, gmMessage]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-panel">
      <h3>Macera Günlüğü</h3>
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.role}`}>
            <span className="chat-role">
              {m.role === 'gm' ? 'GM' : 'Sen'}
              {m.source === 'mock' && <span className="chat-source-tag"> (mock)</span>}
            </span>
            <p>{m.text}</p>
            {m.role === 'gm' && m.roll && (
              <p className="roll-tag">
                {ATTR_LABELS_TR[m.roll.attribute]} kontrolü: {m.roll.roll}+{m.roll.modifier}={m.roll.total} (DC {m.roll.dc}) —{' '}
                {OUTCOME_LABELS_TR[m.roll.outcome]}
              </p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
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
