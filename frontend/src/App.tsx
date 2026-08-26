import { useEffect, useState } from 'react';
import './App.css';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterCard } from './components/CharacterCard';
import { ChatPanel } from './components/ChatPanel';
import { TacticalGrid } from './components/TacticalGrid';
import { IntroScreen } from './components/IntroScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { HelpModal } from './components/HelpModal';
import { HeaderHud } from './components/HeaderHud';
import { getCurrentCharacter, getScene, moveToken, resetSession, NetworkError } from './api';
import type { Character, Scene, SpellId } from './types';

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
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  // Faz 11 (PM kararı): karşılaşma temizlenince yeni karşılaşma HEMEN sahneye
  // girmiyor - sahne "nefes alma" penceresine giriyor (backend:
  // pendingEncounterIndex). Bu sırada gerçekten düşman yok, o yüzden
  // hasEnemies'e KARIŞTIRMIYORUZ - grid gizlenip tam ekran metin moduna
  // dönülüyor. Devam etmek için ayrı bir "Devam Et" butonu gösteriyoruz.
  const [pendingEncounter, setPendingEncounter] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  // Yaratıcı cron fikir #33: canlıyken karakterden vazgeçip yeniden başlamanın
  // tek yolu ölmekti - karakter panelinde bir "Yeni Karaktere Başla" seçeneği
  // ekliyoruz, yanlışlıkla silmeyi önlemek için önce inline bir onay istiyor.
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  // Faz 12-B (serbest-form mimari sıfırlaması, kullanıcı kararı): chat artık
  // varsayılan/tek arayüz - grid'in `hasEnemies` oldu mu diye ZORUNLU açılma
  // mantığı kaldırıldı, yerine manuel bir toggle geldi. Büyü/eşya fırlatma
  // hedef-seçimi hâlâ grid'e tıklamayı gerektirdiğinden (freeform sistem
  // henüz cast/throw'u kapsamıyor, bkz. Faz 12-A) o akış hâlâ grid'i
  // otomatik açıyor (aşağıdaki showGrid formülündeki OR'un ikinci kısmı).
  const [manualGridOpen, setManualGridOpen] = useState(false);
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

  function handleSceneUpdate(scene: Scene) {
    setPendingEncounter(scene.pendingEncounterIndex != null);
  }

  // Faz 11: "nefes alma" penceresinde (pendingEncounterIndex set) grid gizli -
  // oyuncu bir kareye tıklayamıyor, o yüzden geçişi tetiklemek için ayrı bir
  // buton kullanıyoruz. Backend'de resolvePendingEncounter koordinatlara
  // bakmadan devreye giriyor, bu yüzden (0,0) ile çağırmak yeterli.
  async function handleContinueToNextArea() {
    setContinueError(null);
    setContinuing(true);
    try {
      const { scene: updated, narration, character: updatedCharacter } = await moveToken('player', 0, 0);
      handleSceneUpdate(updated);
      if (updatedCharacter) setCharacter(updatedCharacter);
      if (narration) setChatRefreshTick((tick) => tick + 1);
      setSceneRefreshTick((tick) => tick + 1);
    } catch (e) {
      setContinueError((e as Error).message);
    } finally {
      setContinuing(false);
    }
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
    setRestartError(null);
    setRestarting(true);
    try {
      await resetSession();
      setCharacter(null);
      setPendingIntro(null);
      setThrowingItemId(null);
      setCastingSpellId(null);
      setSceneRefreshTick(0);
      setChatRefreshTick(0);
      setEncountersCleared(null);
      setPendingEncounter(false);
      setContinueError(null);
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
          encountersCleared={encountersCleared}
          onRestart={handleRestart}
          restarting={restarting}
          restartError={restartError}
        />
      </div>
    );
  }

  // Fırlatma/büyü hedef-seçimi grid'e tıklamayı gerektiriyor - kapalıyken
  // bile (örn. boş bir kareye eşya fırlatmak) grid'in geçici olarak görünmesi
  // gerekiyor, aksi halde hedef seçilemez.
  const showGrid = manualGridOpen || Boolean(throwingItemId || castingSpellId);

  return (
    <div className="app app-game">
      <header className="app-header">
        <h1>D&D AI Game Master</h1>
        <HeaderHud character={character} />
        <div className="app-header-actions">
          <button
            type="button"
            className="grid-toggle-button"
            onClick={() => setManualGridOpen((v) => !v)}
            title="Taktik Harita"
            aria-label="Taktik haritayı aç/kapat"
            aria-pressed={manualGridOpen}
          >
            <span aria-hidden="true">⚔️</span> <span>Harita</span>
          </button>
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
      <main className={`app-main ${showGrid ? 'mode-combat' : 'mode-text'}`}>
        {pendingEncounter && !showGrid && (
          <div className="pending-encounter-banner">
            <span>Alanı temizledin, ilerliyorsun...</span>
            <button type="button" onClick={handleContinueToNextArea} disabled={continuing}>
              {continuing ? 'İlerleniyor...' : 'Devam Et'}
            </button>
            {continueError && <span className="error">{continueError}</span>}
          </div>
        )}
        <ChatPanel refreshKey={chatRefreshTick} onCharacterChange={setCharacter} />
        <TacticalGrid
          characterId={character.id}
          playerHp={character.hp.current}
          playerMaxHp={character.hp.max}
          throwingItemId={throwingItemId}
          castingSpellId={castingSpellId}
          refreshKey={sceneRefreshTick}
          onSceneUpdate={handleSceneUpdate}
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
