import { useEffect, useRef, useState } from 'react';
import { attackTarget, castSpell, endTurn, getCurrentCharacter, getScene, moveToken, throwItem } from '../api';
import type { Character, Scene, SpellId } from '../types';

// İnovasyon fikri #45: backend'deki scene.js FIREBALL_AOE_RADIUS ile aynı -
// hedef seçerken patlamanın hangi diğer düşmanları vuracağını önceden
// göstermek için (proje genelinde kod paylaşımı yok, leveling.js/dndNames.ts
// sabitlerindeki mevcut desenle tutarlı).
const FIREBALL_AOE_RADIUS = 1;

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

interface Props {
  characterId: string;
  // İnovasyon fikri #39: oyuncu token'ının canını da grid üzerinde görünür
  // kılmak için - backend scene.tokens'taki "player" token'ı hp/maxHp
  // taşımıyor (oyuncu HP'si character'da tutuluyor), o yüzden App.tsx
  // zaten elindeki character.hp'yi buraya prop olarak geçiriyor.
  playerHp?: number;
  playerMaxHp?: number;
  throwingItemId?: string | null;
  castingSpellId?: SpellId | null;
  onThrowComplete?: (character: Character) => void;
  onCastComplete?: (character: Character) => void;
  onTurnResolved?: (enemyMessages: string[]) => void;
  onCharacterChange?: (character: Character) => void;
  onChatActivity?: () => void;
  // Faz 11: App'in "savaş modu" (grid görünür/gizli) kararını verebilmesi
  // için - ekstra bir "savaş modu" state'i TUTMUYORUZ, App bu callback'ten
  // gelen sahneden `scene.tokens.some(t => t.type === 'enemy')` ile türetiyor.
  onSceneUpdate?: (scene: Scene) => void;
  refreshKey?: number;
}

export function TacticalGrid({
  characterId,
  playerHp,
  playerMaxHp,
  throwingItemId = null,
  castingSpellId = null,
  onThrowComplete,
  onCastComplete,
  onTurnResolved,
  onCharacterChange,
  onChatActivity,
  onSceneUpdate,
  refreshKey = 0,
}: Props) {
  const [scene, setSceneState] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Faz 11 polish: saldırı isabet edince hedefin bulunduğu karede kısa bir
  // "sallanma/flaş" + üzerinde beliren bir hasar sayısı göstermek için. Hedef
  // ölürse token sahneden kalkıyor ama koordinatı burada yakaladığımız için
  // popup yine de doğru karede beliriyor.
  // İnovasyon fikri #46: Ateş Topu artık AoE (fikir #43), tek bir cast'te
  // birden fazla hücre AYNI ANDA etkilenebiliyor - tekil objeden diziye
  // çevrildi (handleAttack de aynı diziyi kullanıyor, tutarlı).
  const [damageFx, setDamageFx] = useState<{ x: number; y: number; damage: number; key: number }[]>([]);
  const damageFxKeyRef = useRef(0);

  // İnovasyon fikri #45: Ateş Topu hedef-seç modunda bir düşmana hover
  // yapınca (mobilde tap-preview yerine basit hover yeterli görüldü, PM'in
  // önerisiyle tutarlı) patlamanın da vuracağı diğer düşmanları önizlemek için.
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);

  // Faz 11 polish: token'lar anlık "zıplamak" yerine kareler arası kayarak
  // hareket etsin diye - her hücrenin gerçek piksel konumunu ölçüp bir
  // overlay katmanındaki token işaretçilerini bu konumlara `left`/`top`
  // transition'ıyla yerleştiriyoruz. Yüzde bazlı bir hesap `gap`/`padding`
  // yüzünden hücre sınırlarıyla tam örtüşmeyeceğinden gerçek ölçüm kullanıldı.
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellRects, setCellRects] = useState<Map<string, { left: number; top: number; width: number; height: number }>>(
    new Map(),
  );

  function setScene(updated: Scene) {
    setSceneState(updated);
    onSceneUpdate?.(updated);
  }

  useEffect(() => {
    getScene().then(setScene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;

    function measure() {
      const containerRect = gridEl!.getBoundingClientRect();
      const next = new Map<string, { left: number; top: number; width: number; height: number }>();
      gridEl!.querySelectorAll<HTMLButtonElement>('.cell').forEach((cellEl) => {
        const { x, y } = cellEl.dataset;
        if (x == null || y == null) return;
        const rect = cellEl.getBoundingClientRect();
        next.set(`${x},${y}`, {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        });
      });
      setCellRects(next);
    }

    measure();
    // jsdom (test ortamı) ResizeObserver sağlamıyor - overlay konumlandırması
    // sadece gerçek bir tarayıcıda gerekli, testlerde ilk ölçüm yeterli.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [scene?.width, scene?.height]);

  async function handleThrowTarget(x: number, y: number) {
    if (!throwingItemId) return;
    setError(null);
    try {
      const { character, scene: updated } = await throwItem(characterId, throwingItemId, x, y);
      setScene(updated);
      onThrowComplete?.(character);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCastTarget(targetTokenId: string) {
    if (!castingSpellId) return;
    setError(null);
    // Fikir #46: AoE'de öldürülen düşmanlar `updated` sahnesinden kalkmış
    // olabilir - koordinatlarını cast ÖNCESİ sahneden yakalıyoruz (handleAttack
    // ile aynı desen), yoksa popup'ın nereye çizileceğini bilemeyiz.
    const preCastPositions = new Map(scene?.tokens.map((t) => [t.id, { x: t.x, y: t.y }]) ?? []);
    try {
      const { character, scene: updated, damage, blastHits } = await castSpell(characterId, castingSpellId, targetTokenId);
      if (updated) setScene(updated);
      if (blastHits && blastHits.length > 0) {
        for (const hit of blastHits) {
          const pos = preCastPositions.get(hit.id);
          if (pos && hit.damage > 0) triggerDamageFx(pos.x, pos.y, hit.damage);
        }
      } else if (damage && damage > 0) {
        // İyileştir gibi blastHits taşımayan büyüler için (ya da eski API
        // yanıtı) tek-hedef fallback.
        const pos = preCastPositions.get(targetTokenId);
        if (pos) triggerDamageFx(pos.x, pos.y, damage);
      }
      onCastComplete?.(character);
      onChatActivity?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleMoveTarget(x: number, y: number) {
    if (!scene) return;
    const activeToken = scene.tokens.find((t) => t.id === scene.activeTokenId);
    if (activeToken?.type !== 'player') {
      setError('Sıra sende değil.');
      return;
    }
    setError(null);
    try {
      const { scene: updated, narration, character } = await moveToken(scene.activeTokenId, x, y);
      setScene(updated);
      if (character) onCharacterChange?.(character);
      if (narration) onChatActivity?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAttack(targetTokenId: string) {
    setError(null);
    const target = scene?.tokens.find((t) => t.id === targetTokenId);
    try {
      const { character, scene: updated, damage } = await attackTarget(characterId, targetTokenId);
      setScene(updated);
      if (target && damage > 0) triggerDamageFx(target.x, target.y, damage);
      onCharacterChange?.(character);
      onChatActivity?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function triggerDamageFx(x: number, y: number, damage: number) {
    // AoE'de aynı anda birden fazla hücre tetiklenebildiğinden Date.now()
    // tek başına çakışabilir (aynı ms içinde) - monoton bir sayaç kullanılıyor.
    const key = ++damageFxKeyRef.current;
    setDamageFx((current) => [...current, { x, y, damage, key }]);
    window.setTimeout(() => {
      setDamageFx((current) => current.filter((fx) => fx.key !== key));
    }, 700);
  }

  function handleCellClick(x: number, y: number) {
    if (throwingItemId) {
      handleThrowTarget(x, y);
      return;
    }
    const key = `${x},${y}`;
    const token = scene?.tokens.find((t) => `${t.x},${t.y}` === key);
    if (castingSpellId) {
      if (token?.type === 'enemy') {
        handleCastTarget(token.id);
      }
      // Büyü hedef-seç modundayken düşman olmayan bir hücreye tıklamak
      // no-op olmalı - yanlışlıkla hareket ettirmemeli.
      return;
    }
    if (token?.type === 'enemy') {
      // İnovasyon fikri #51: Aksiyon tükendikten sonra bitişik düşmana
      // tıklamak öncesinde backend'e gidip 400 ile geri dönüyordu (gereksiz
      // round-trip + kafa karıştırıcı, "Aksiyon: ✗" göstergesi sadece
      // bilgilendiriciydi). Artık aynı kontrolü frontend'de de yapıp
      // isteği hiç göndermiyoruz.
      if (playerToken && !playerToken.actionAvailable) {
        setError('Bu tur için Aksiyon hakkın kalmadı.');
        return;
      }
      handleAttack(token.id);
      return;
    }
    handleMoveTarget(x, y);
  }

  async function handleEndTurn() {
    // İnovasyon fikri #47: düşman turu otomatik saldırıp oyuncuya hasar
    // verebiliyor ama `/scene/end-turn` yapısal bir hasar sayısı döndürmüyor
    // (sadece serbest anlatım metni) - backend'e dokunmadan, tur öncesi
    // `playerHp` prop'unu tur sonrası taze bir `/character` isteğiyle
    // karşılaştırıp aradaki farkı oyuncu token'ının karesinde gösteriyoruz.
    const hpBefore = playerHp;
    const { enemyMessages, ...updated } = await endTurn();
    setScene(updated);
    onTurnResolved?.(enemyMessages);

    if (enemyMessages.length > 0 && hpBefore !== undefined) {
      try {
        const freshCharacter = await getCurrentCharacter();
        const damage = hpBefore - freshCharacter.hp.current;
        if (damage > 0) {
          const playerToken = updated.tokens.find((t) => t.id === 'player');
          if (playerToken) triggerDamageFx(playerToken.x, playerToken.y, damage);
        }
      } catch {
        // Görsel bir polish - sessizce yut, ana tur akışını etkilemesin.
      }
    }
  }

  if (!scene) return <div className="tactical-grid">Harita yükleniyor...</div>;

  const obstacleSet = new Set(scene.obstacles.map((o) => `${o.x},${o.y}`));
  const lootMap = new Map(scene.loot.map((l) => [`${l.x},${l.y}`, l]));
  const tokenMap = new Map(scene.tokens.map((t) => [`${t.x},${t.y}`, t]));

  const rows = Array.from({ length: scene.height }, (_, y) => y);
  const cols = Array.from({ length: scene.width }, (_, x) => x);
  const activeToken = scene.tokens.find((t) => t.id === scene.activeTokenId);
  const isPlayerTurn = activeToken?.type === 'player';
  const specialMode = Boolean(throwingItemId || castingSpellId);
  const gridInteractive = specialMode ? true : isPlayerTurn;
  const playerToken = scene.tokens.find((t) => t.id === 'player');
  // İnovasyon fikri #51: Aksiyon tükenmişse düşman hücreleri (saldırı hedefi)
  // görsel olarak devre dışı görünsün - hareket hâlâ mümkün (Aksiyon
  // ekonomisi sadece saldırı/büyü/eşya kullanımını kapsıyor), o yüzden
  // TÜM grid değil sadece düşman hücreleri etkileniyor.
  const actionExhausted = isPlayerTurn && !specialMode && Boolean(playerToken) && !playerToken!.actionAvailable;

  // İnovasyon fikri #45: hover edilen düşmana bitişik (blast yarıçapı
  // içindeki) DİĞER düşmanların id'leri - sadece Ateş Topu hedef-seç
  // modundayken anlamlı.
  const aoePreviewIds = new Set<string>();
  if (castingSpellId === 'fireball' && hoveredEnemyId) {
    const hoveredToken = scene.tokens.find((t) => t.id === hoveredEnemyId);
    if (hoveredToken) {
      for (const t of scene.tokens) {
        if (t.type === 'enemy' && t.id !== hoveredToken.id && manhattan(t, hoveredToken) <= FIREBALL_AOE_RADIUS) {
          aoePreviewIds.add(t.id);
        }
      }
    }
  }

  return (
    <div className="tactical-grid">
      <div className="scene-header">
        <h3>{scene.name}</h3>
        <span className="encounter-progress">
          Karşılaşma: {scene.encounterIndex + 1}/{scene.totalEncounters}
        </span>
        <span>
          {throwingItemId
            ? 'Fırlatma hedefi seç'
            : castingSpellId
              ? 'Büyü hedefi seç'
              : `Tur ${scene.round} · Sıra: ${activeToken?.name}${!isPlayerTurn ? ' (senin sıran değil)' : ''}`}
        </span>
        {playerToken && (
          <span className="movement-economy">
            Hareket: {playerToken.movementLeft}/{playerToken.speed}
          </span>
        )}
        {playerToken && (
          <span className="action-economy">
            Aksiyon: {playerToken.actionAvailable ? '✓' : '✗'} · Bonus: {playerToken.bonusActionAvailable ? '✓' : '✗'}
          </span>
        )}
        <button onClick={handleEndTurn}>Turu Bitir</button>
      </div>

      {!specialMode && isPlayerTurn && (
        <p className="throw-hint">
          {actionExhausted
            ? 'Bu tur için Aksiyonun kalmadı - düşmanlara saldıramazsın, ama hâlâ hareket edebilirsin.'
            : 'Bitişik bir düşmana tıklayarak saldırabilirsin.'}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <div
        ref={gridRef}
        className={`grid ${gridInteractive ? '' : 'grid-disabled'} ${specialMode ? 'grid-throw-mode' : ''}`}
        style={{ gridTemplateColumns: `repeat(${scene.width}, 1fr)` }}
        onMouseLeave={() => setHoveredEnemyId(null)}
      >
        {rows.map((y) =>
          cols.map((x) => {
            const key = `${x},${y}`;
            const token = tokenMap.get(key);
            const loot = lootMap.get(key);
            const blocked = obstacleSet.has(key);
            let className = 'cell';
            if (blocked) className += ' obstacle';
            if (loot) className += ' loot';
            const cellDamageFx = damageFx.find((fx) => fx.x === x && fx.y === y);
            if (cellDamageFx) className += ' damage-flash';
            if (token && aoePreviewIds.has(token.id)) className += ' aoe-preview';
            if (token?.type === 'enemy' && actionExhausted) className += ' enemy-disabled';

            const cellLabel = token
              ? `${token.name}${token.hp !== undefined ? ` (${token.hp}/${token.maxHp} HP)` : ''}`
              : loot
                ? loot.name
                : `Boş kare (${x}, ${y})`;

            return (
              <button
                key={key}
                data-x={x}
                data-y={y}
                className={className}
                onClick={() => handleCellClick(x, y)}
                onMouseEnter={() =>
                  setHoveredEnemyId(castingSpellId === 'fireball' && token?.type === 'enemy' ? token.id : null)
                }
                title={cellLabel}
                aria-label={cellLabel}
              >
                {!token && loot ? '◆' : ''}
                {cellDamageFx && (
                  <span key={cellDamageFx.key} className="damage-popup">
                    -{cellDamageFx.damage}
                  </span>
                )}
              </button>
            );
          }),
        )}
        <div className="token-layer">
          {scene.tokens.map((t) => {
            const rect = cellRects.get(`${t.x},${t.y}`);
            if (!rect) return null;
            const hp = t.id === 'player' ? playerHp : t.hp;
            const maxHp = t.id === 'player' ? playerMaxHp : t.maxHp;
            const hpPct = maxHp ? Math.max(0, Math.min(100, ((hp ?? 0) / maxHp) * 100)) : null;
            return (
              <div
                key={t.id}
                className={`token-marker ${t.type === 'player' ? 'player-token' : 'enemy-token'}${
                  t.type === 'enemy' && actionExhausted ? ' token-disabled' : ''
                }`}
                style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              >
                {t.name[0]}
                {hpPct !== null && (
                  <div className="token-hp-bar">
                    <div
                      className={`token-hp-bar-fill ${hpPct <= 25 ? 'low' : hpPct <= 50 ? 'mid' : ''}`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
