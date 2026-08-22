import type { ActionRoll, AppearanceOption, Attributes, Character, ChatMessage, ClassOption, RaceOption, Scene } from './types';

export interface Narration {
  text: string;
  source: 'ai' | 'mock';
}

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `İstek başarısız: ${path}`);
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

export function updateCharacter(patch: Partial<Character>) {
  return request<Character>('/character', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export function getChatHistory() {
  return request<{ messages: ChatMessage[] }>('/chat');
}

export function sendChatMessage(message: string) {
  return request<{ playerMessage: ChatMessage; gmMessage: ChatMessage }>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function getScene() {
  return request<Scene>('/scene');
}

export function moveToken(tokenId: string, x: number, y: number) {
  return request<{ scene: Scene; collectedLoot: unknown; narration: Narration | null }>('/scene/move', {
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
    narration: Narration;
  }>('/scene/attack', {
    method: 'POST',
    body: JSON.stringify({ characterId, targetTokenId }),
  });
}

export function endTurn() {
  return request<Scene & { enemyMessages: string[] }>('/scene/end-turn', { method: 'POST' });
}

export function useItem(characterId: string, itemId: string) {
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
