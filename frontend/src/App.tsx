import { useEffect, useState } from 'react';
import './App.css';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterCard } from './components/CharacterCard';
import { ChatPanel } from './components/ChatPanel';
import { TacticalGrid } from './components/TacticalGrid';
import { IntroScreen } from './components/IntroScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { HelpModal } from './components/HelpModal';
import { getCurrentCharacter, getScene, resetSession, NetworkError } from './api';
import type { Character, SpellId } from './types';

// Faz 9 (yaratıcı cron fikir #4): Render'ın soğuk başlangıcında ilk istek
// 30-60sn sürebiliyor - sessizce hata yutmak yerine kullanıcıya "bağlanılıyor"
// geri bildirimi verip birkaç kez otomatik deniyoruz.
const CONNECT_RETRY_COUNT = 3;
const CONNECT_RETRY_DELAY_MS = 4000;

// Yaratıcı cron fikir #5: "Nasıl Oynanır?" modalını bir kez gösterip bir
// daha göstermemek için localStorage'da işaretliyoruz - erişilemezse
// (gizli sekme vb.) modal her seferinde gösterilir, çökmez.
const HELP_SEEN_KEY = 'dnd-help-seen';

function hasSeenHelp() {
  try {
    return localStorage.getItem(HELP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markHelpSeen() {
  try {
    localStorage.setItem(HELP_SEEN_KEY, '1');
  } catch {
    // yoksay
  }
}

function App() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [pendingIntro, setPendingIntro] = useState<{ text: string; source: 'ai' | 'mock' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectRetry, setConnectRetry] = useState(0);
  const [throwingItemId, setThrowingItemId] = useState<string | null>(null);
  const [castingSpellId, setCastingSpellId] = useState<SpellId | null>(null);
  const [sceneRefreshTick, setSceneRefreshTick] = useState(0);
  const [chatRefreshTick, setChatRefreshTick] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [encountersCleared, setEncountersCleared] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialCharacter() {
      for (let attempt = 0; attempt <= CONNECT_RETRY_COUNT; attempt++) {
        try {
          const current = await getCurrentCharacter();
          if (!cancelled) setCharacter(current);
          return;
        } catch (e) {
          if (!(e instanceof NetworkError)) {
            // Gerçek bir HTTP hatası (örn. "aktif karakter yok" 404'ü) -
            // bağlantı sorunu değil, oluşturma formu gösterilecek.
            return;
          }
          if (attempt === CONNECT_RETRY_COUNT || cancelled) return;
          if (!cancelled) setConnectRetry(attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
        }
      }
    }

    loadInitialCharacter().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(newCharacter: Character, intro: { text: string; source: 'ai' | 'mock' }) {
    setCharacter(newCharacter);
    setPendingIntro(intro);
  }

  // Oyun ekranına ilk defa (ister yeni karakterle intro'dan sonra, ister
  // var olan bir session ile sayfa yenilendiğinde) ulaşıldığında bir kerelik
  // yardım modalını göster.
  useEffect(() => {
    if (character && !pendingIntro && character.hp.current > 0 && !hasSeenHelp()) {
      setShowHelp(true);
      markHelpSeen();
    }
  }, [character, pendingIntro]);

  // Yaratıcı cron fikir #9: Game Over ekranında bir macera özeti göstermek
  // için sahnenin encounterIndex'ine ihtiyaç var - App normalde sahne state'i
  // tutmuyor (TacticalGrid kendi yönetiyor), bu yüzden sadece karakter
  // öldüğünde bir kerelik ayrıca çekiyoruz.
  useEffect(() => {
    if (character && character.hp.current <= 0) {
      getScene()
        .then((scene) => setEncountersCleared(scene.encounterIndex))
        .catch(() => {});
    }
  }, [character]);

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

  async function handleRestart() {
    await resetSession();
    setCharacter(null);
    setPendingIntro(null);
    setThrowingItemId(null);
    setCastingSpellId(null);
    setSceneRefreshTick(0);
    setChatRefreshTick(0);
    setEncountersCleared(null);
  }

  if (loading) {
    return (
      <div className="app app-centered">
        <p>
          {connectRetry > 0
            ? `Bağlantı kurulamadı, tekrar deneniyor... (${connectRetry}/${CONNECT_RETRY_COUNT})`
            : 'Yükleniyor...'}
        </p>
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

  if (character.hp.current <= 0) {
    return (
      <div className="app app-centered">
        <GameOverScreen
          characterName={character.name}
          level={character.level}
          xp={character.xp}
          encountersCleared={encountersCleared}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  return (
    <div className="app app-game">
      <header className="app-header">
        <h1>D&D AI Game Master</h1>
        <button type="button" className="help-button" onClick={() => setShowHelp(true)} title="Nasıl Oynanır?">
          ❓
        </button>
      </header>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <main className="app-main">
        <CharacterCard
          character={character}
          onCharacterChange={handleCharacterChange}
          throwingItemId={throwingItemId}
          onStartThrow={setThrowingItemId}
          onCancelThrow={() => setThrowingItemId(null)}
          castingSpellId={castingSpellId}
          onStartCast={setCastingSpellId}
          onCancelCast={() => setCastingSpellId(null)}
          onChatActivity={handleChatActivity}
        />
        <ChatPanel refreshKey={chatRefreshTick} />
        <TacticalGrid
          characterId={character.id}
          throwingItemId={throwingItemId}
          castingSpellId={castingSpellId}
          refreshKey={sceneRefreshTick}
          onThrowComplete={(updated) => {
            setCharacter(updated);
            setThrowingItemId(null);
          }}
          onCastComplete={(updated) => {
            setCharacter(updated);
            setCastingSpellId(null);
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
