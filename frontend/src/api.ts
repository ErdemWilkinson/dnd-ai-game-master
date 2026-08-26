import type { ActionRoll, AppearanceOption, Attributes, Character, ChatMessage, ClassOption, RaceOption, Scene, SpellId } from './types';
import { getSessionId } from './session';

export interface Narration {
  text: string;
  source: 'ai' | 'mock';
}

// Faz 7-C: yerelde Vite dev proxy'si "/api"yi backend'e yönlendirir (bkz.
// vite.config.ts). Production build'de (Render Static Site gibi ayrı bir
// origin'den servis edilince) proxy olmaz - build-time VITE_API_BASE ortam
// değişkeni backend'in tam URL'ini vermeli (örn. "https://xxx.onrender.com/api").
const BASE = import.meta.env.VITE_API_BASE || '/api';

// Faz 9 (yaratıcı cron fikir #4): Render'ın ücretsiz servisleri ~15dk
// hareketsizlikten sonra "uyuyor", ilk istek 30-60sn sürebiliyor - bu sırada
// fetch() ağ hatasıyla (backend'e hiç ulaşamama) reddedilir. Bunu normal bir
// HTTP hatasından (ör. "aktif karakter yok" 404'ü) ayırt edebilmek için ayrı
// bir hata sınıfı kullanılıyor - App.tsx sadece NetworkError'da retry gösteriyor.
export class NetworkError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
      ...options,
    });
  } catch (e) {
    throw new NetworkError((e as Error).message || 'Bağlantı kurulamadı.');
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new NetworkError('Sunucudan geçersiz yanıt alındı.');
  }
  if (!res.ok) {
    let message = data.error || `İstek başarısız: ${path}`;
    // İnovasyon fikri #79: 429 durumunda backend (publicRateLimit.js,
    // standardHeaders:true) bir Retry-After header'ı (saniye cinsinden)
    // gönderiyordu ama hiçbir yerde okunmuyordu - kullanıcı ne kadar
    // beklemesi gerektiğini bilmeden aynı hata mesajını görüyordu.
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        message += ` (${retryAfter} saniye sonra tekrar dene.)`;
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export function getCharacterOptions() {
  return request<{ races: RaceOption[]; classes: ClassOption[]; appearances: AppearanceOption[] }>(
    '/character/options',
  );
}

export function rollStats(raceId: string) {
  return request<{ rolls: Attributes; attributes: Attributes }>('/character/roll-stats', {
    method: 'POST',
    body: JSON.stringify({ raceId }),
  });
}

export function createCharacter(
  name: string,
  raceId: string,
  classId: string,
  appearanceId: string,
  attributes: Attributes,
) {
  return request<Character>('/character/create', {
    method: 'POST',
    body: JSON.stringify({ name, raceId, classId, appearanceId, attributes }),
  });
}

export function getCharacterIntro(characterId: string) {
  return request<{ text: string; source: 'ai' | 'mock' }>('/character/intro', {
    method: 'POST',
    body: JSON.stringify({ characterId }),
  });
}

export function getCurrentCharacter() {
  return request<Character>('/character');
}

export function getChatHistory() {
  return request<{ messages: ChatMessage[] }>('/chat');
}

export function sendChatMessage(message: string) {
  return request<{ playerMessage: ChatMessage; gmMessage: ChatMessage; character: Character | null }>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function getScene() {
  return request<Scene>('/scene');
}

export function moveToken(tokenId: string, x: number, y: number) {
  return request<{
    scene: Scene;
    collectedLoot: unknown;
    inventoryFull: boolean;
    narration: Narration | null;
    character: Character | null;
  }>('/scene/move', {
    method: 'POST',
    body: JSON.stringify({ tokenId, x, y }),
  });
}

export function attackTarget(characterId: string, targetTokenId: string) {
  return request<{
    character: Character;
    scene: Scene;
    attackResult: ActionRoll;
    damage: number;
    defeated: boolean;
    levelsGained: number;
    narration: Narration;
  }>('/scene/attack', {
    method: 'POST',
    body: JSON.stringify({ characterId, targetTokenId }),
  });
}

export function castSpell(characterId: string, spellId: SpellId, targetTokenId?: string) {
  return request<{
    character: Character;
    scene: Scene;
    spell: SpellId;
    castResult?: ActionRoll;
    damage?: number;
    defeated?: boolean;
    // İnovasyon fikri #43 (Ateş Topu AoE): isabet edilen her düşman için ayrı
    // {id,name,damage,defeated} - fikir #46'da hasar popup'larını doğru
    // hücrelerde göstermek için kullanılıyor.
    blastHits?: { id: string; name: string; damage: number; defeated: boolean }[];
    levelsGained?: number;
    healed?: number;
    narration: Narration;
  }>('/scene/cast', {
    method: 'POST',
    body: JSON.stringify({ characterId, spellId, targetTokenId }),
  });
}

export function resetSession() {
  return request<{ ok: boolean }>('/character/reset', { method: 'POST' });
}

export function endTurn() {
  return request<Scene & { enemyMessages: string[] }>('/scene/end-turn', { method: 'POST' });
}

// İnovasyon fikri #60: adı "consumeItem" - eskiden "useItem" idi ama bu isim
// React'in hook adlandırma kuralına (use...) yanlışlıkla uyduğundan
// oxlint'in react-hooks/rules-of-hooks kuralı, bunu normal bir fonksiyondan
// (component/hook olmayan `handleUse` içinde) çağırınca hatalı bir "hook
// kuralı ihlali" raporluyordu - fonksiyonel bir sorun değil, sadece isim
// çakışması, o yüzden yeniden adlandırıldı.
export function consumeItem(characterId: string, itemId: string) {
  return request<{ character: Character }>('/scene/item/use', {
    method: 'POST',
    body: JSON.stringify({ characterId, itemId }),
  });
}

export function equipItem(characterId: string, itemId: string) {
  return request<{ character: Character }>('/scene/item/equip', {
    method: 'POST',
    body: JSON.stringify({ characterId, itemId }),
  });
}

export function dropItem(characterId: string, itemId: string) {
  return request<{ character: Character }>('/scene/item/drop', {
    method: 'POST',
    body: JSON.stringify({ characterId, itemId }),
  });
}

export function throwItem(characterId: string, itemId: string, x: number, y: number) {
  return request<{ character: Character; scene: Scene }>('/scene/item/throw', {
    method: 'POST',
    body: JSON.stringify({ characterId, itemId, x, y }),
  });
}
