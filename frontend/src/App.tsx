import { useEffect, useState } from 'react';
import './App.css';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterCard } from './components/CharacterCard';
import { ChatPanel } from './components/ChatPanel';
import { TacticalGrid } from './components/TacticalGrid';
import { IntroScreen } from './components/IntroScreen';
import { getCurrentCharacter } from './api';
import type { Character } from './types';

function App() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [pendingIntro, setPendingIntro] = useState<{ text: string; source: 'ai' | 'mock' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [throwingItemId, setThrowingItemId] = useState<string | null>(null);
  const [sceneRefreshTick, setSceneRefreshTick] = useState(0);
  const [chatRefreshTick, setChatRefreshTick] = useState(0);

  useEffect(() => {
    getCurrentCharacter()
      .then(setCharacter)
      .catch(() => {
        // aktif karakter yok, oluşturma formu gösterilecek
      })
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(newCharacter: Character, intro: { text: string; source: 'ai' | 'mock' }) {
    setCharacter(newCharacter);
    setPendingIntro(intro);
  }

  function handleCharacterChange(updated: Character) {
    setCharacter(updated);
    // CharacterCard'daki eylemler (kullan/kuşan/at) sahnedeki Aksiyon/Bonus
    // göstergesini de etkileyebilir - TacticalGrid'i tazelemesi için tetikle.
    setSceneRefreshTick((tick) => tick + 1);
  }

  function handleTurnResolved(enemyMessages: string[]) {
    if (enemyMessages.length === 0) return;
    // Düşman turu otomatik saldırı içerebilir (HP değişmiş olabilir) ve
    // sohbet geçmişine yeni mesajlar eklenmiş olabilir - ikisini de tazele.
    getCurrentCharacter().then(setCharacter).catch(() => {});
    setChatRefreshTick((tick) => tick + 1);
  }

  function handleChatActivity() {
    // Hareket/saldırı sonrası otomatik anlatım sohbet geçmişine eklenmiş olabilir.
    setChatRefreshTick((tick) => tick + 1);
  }

  if (loading) {
    return (
      <div className="app app-centered">
        <p>Yükleniyor...</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="app app-centered">
        <CharacterCreation onCreated={handleCreated} />
      </div>
    );
  }

  if (pendingIntro) {
    return (
      <div className="app app-centered">
        <IntroScreen
          text={pendingIntro.text}
          source={pendingIntro.source}
          onContinue={() => setPendingIntro(null)}
        />
      </div>
    );
  }

  return (
    <div className="app app-game">
      <header className="app-header">
        <h1>D&D AI Game Master</h1>
      </header>
      <main className="app-main">
        <CharacterCard
          character={character}
          onCharacterChange={handleCharacterChange}
          throwingItemId={throwingItemId}
          onStartThrow={setThrowingItemId}
          onCancelThrow={() => setThrowingItemId(null)}
        />
        <ChatPanel refreshKey={chatRefreshTick} />
        <TacticalGrid
          characterId={character.id}
          throwingItemId={throwingItemId}
          refreshKey={sceneRefreshTick}
          onThrowComplete={(updated) => {
            setCharacter(updated);
            setThrowingItemId(null);
          }}
          onTurnResolved={handleTurnResolved}
          onCharacterChange={setCharacter}
          onChatActivity={handleChatActivity}
        />
      </main>
      <footer className="app-footer">
        İkonlar /tg/station projesinden, CC BY-SA 3.0 lisansı altında alınmıştır (github.com/tgstation/tgstation).
      </footer>
    </div>
  );
}

export default App;
