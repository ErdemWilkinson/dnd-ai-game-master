import { useEffect, useState } from 'react';
import './App.css';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterCard } from './components/CharacterCard';
import { ChatPanel } from './components/ChatPanel';
import { IntroScreen } from './components/IntroScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { HelpModal } from './components/HelpModal';
import { HeaderHud } from './components/HeaderHud';
import { getCurrentCharacter, resetSession, NetworkError } from './api';
import type { Character } from './types';

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
  const [showHelp, setShowHelp] = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  // Yaratıcı cron fikir #33: canlıyken karakterden vazgeçip yeniden başlamanın
  // tek yolu ölmekti - karakter panelinde bir "Yeni Karaktere Başla" seçeneği
  // ekliyoruz, yanlışlıkla silmeyi önlemek için önce inline bir onay istiyor.
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  // İnovasyon fikri #82: handleRestart()'ta hiç try/catch yoktu - resetSession()
  // başarısız olursa (ağ hatası/Render soğuk başlangıcı) oyuncu Game Over
  // ekranında ya da yeniden başlatma onay kutusunda sessizce takılı kalıyordu.
  // ErrorBoundary (fikir #55) bunu YAKALAMAZ - event handler'daki async
  // hatalar React error boundary kapsamı dışında.
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

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
  // yardım modalını göster. Bilinçli olarak effect içinde bırakıldı (render
  // sırasına taşınmadı) - `markHelpSeen()` gerçek bir dış sistem yan etkisi
  // (localStorage yazımı), render fonksiyonu saf kalmalı; StrictMode'da çift
  // render bunu iki kez tetiklerdi.
  useEffect(() => {
    if (character && !pendingIntro && character.hp.current > 0 && !hasSeenHelp()) {
      // eslint-disable-next-line react/set-state-in-effect
      setShowHelp(true);
      markHelpSeen();
    }
  }, [character, pendingIntro]);

  async function handleRestart() {
    setRestartError(null);
    setRestarting(true);
    try {
      await resetSession();
      setCharacter(null);
      setPendingIntro(null);
      setConfirmingRestart(false);
    } catch (e) {
      setRestartError((e as Error).message);
    } finally {
      setRestarting(false);
    }
  }

  function closeCharacterPanel() {
    setShowCharacterPanel(false);
    setConfirmingRestart(false);
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
          onRestart={handleRestart}
          restarting={restarting}
          restartError={restartError}
        />
      </div>
    );
  }

  return (
    <div className="app app-game">
      <header className="app-header">
        <h1>D&D AI Game Master</h1>
        <HeaderHud character={character} />
        <div className="app-header-actions">
          <button
            type="button"
            className="character-toggle-button"
            onClick={() => setShowCharacterPanel((v) => !v)}
            title={`${character.name} (karakter/envanter)`}
            aria-label={`${character.name} - karakter ve envanteri aç/kapat`}
            aria-pressed={showCharacterPanel}
          >
            <span aria-hidden="true">🎒</span> <span>{character.name}</span>
          </button>
          <button
            type="button"
            className="help-button"
            onClick={() => setShowHelp(true)}
            title="Nasıl Oynanır?"
            aria-label="Nasıl Oynanır? yardım penceresini aç"
          >
            ❓
          </button>
        </div>
      </header>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showCharacterPanel && (
        <div className="character-panel-overlay" onClick={closeCharacterPanel}>
          <div className="character-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="character-panel-close"
              onClick={closeCharacterPanel}
              aria-label="Karakter panelini kapat"
            >
              ✕
            </button>
            <CharacterCard character={character} />
            <div className="restart-character-section">
              {confirmingRestart ? (
                <div className="restart-confirm">
                  <span>Mevcut karakterin silinecek, emin misin?</span>
                  <div className="restart-confirm-actions">
                    <button
                      type="button"
                      className="restart-confirm-yes"
                      onClick={handleRestart}
                      disabled={restarting}
                    >
                      {restarting ? 'Siliniyor...' : 'Evet, Sil'}
                    </button>
                    <button type="button" onClick={() => setConfirmingRestart(false)} disabled={restarting}>
                      Vazgeç
                    </button>
                  </div>
                  {restartError && <span className="error">{restartError} Tekrar dene.</span>}
                </div>
              ) : (
                <button
                  type="button"
                  className="restart-character-button"
                  onClick={() => setConfirmingRestart(true)}
                >
                  Yeni Karaktere Başla
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <main className="app-main">
        <ChatPanel onCharacterChange={setCharacter} />
      </main>
      <footer className="app-footer">
        İkonlar /tg/station projesinden, CC BY-SA 3.0 lisansı altında alınmıştır (
        <a href="https://github.com/tgstation/tgstation" target="_blank" rel="noopener noreferrer">
          github.com/tgstation/tgstation
        </a>
        ).
      </footer>
    </div>
  );
}

export default App;
