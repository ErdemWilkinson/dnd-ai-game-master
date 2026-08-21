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
          onCharacterChange={setCharacter}
          throwingItemId={throwingItemId}
          onStartThrow={setThrowingItemId}
          onCancelThrow={() => setThrowingItemId(null)}
        />
        <TacticalGrid
          characterId={character.id}
          throwingItemId={throwingItemId}
          onThrowComplete={(updated) => {
            setCharacter(updated);
            setThrowingItemId(null);
          }}
        />
        <ChatPanel />
      </main>
    </div>
  );
}

export default App;
