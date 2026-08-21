import { useState } from 'react';
import './App.css';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterCard } from './components/CharacterCard';
import { ChatPanel } from './components/ChatPanel';
import { TacticalGrid } from './components/TacticalGrid';
import type { Character } from './types';

function App() {
  const [character, setCharacter] = useState<Character | null>(null);

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
        <CharacterCard character={character} />
        <TacticalGrid />
        <ChatPanel />
      </main>
    </div>
  );
}

export default App;
