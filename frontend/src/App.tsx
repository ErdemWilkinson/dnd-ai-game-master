import { useEffect, useState } from 'react';
import './App.css';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterCard } from './components/CharacterCard';
import { ChatPanel } from './components/ChatPanel';
import { TacticalGrid } from './components/TacticalGrid';
import { getCurrentCharacter } from './api';
import type { Character } from './types';

function App() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentCharacter()
      .then(setCharacter)
      .catch(() => {
        // aktif karakter yok, oluşturma formu gösterilecek
      })
      .finally(() => setLoading(false));
  }, []);

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
        <CharacterCreation onCreated={setCharacter} />
      </div>
    );
  }

  return (
    <div className="app app-game">
      <header className="app-header">
        <h1>D&D AI Game Master</h1>
      </header>
      <main className="app-main">
        <CharacterCard character={character} onCharacterChange={setCharacter} />
        <TacticalGrid />
        <ChatPanel />
      </main>
    </div>
  );
}

export default App;
