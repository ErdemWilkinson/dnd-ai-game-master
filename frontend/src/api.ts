import type { Character, ChatMessage, ClassOption, RaceOption, Scene } from './types';

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
  return request<{ races: RaceOption[]; classes: ClassOption[] }>('/character/options');
}

export function createCharacter(name: string, raceId: string, classId: string) {
  return request<Character>('/character/create', {
    method: 'POST',
    body: JSON.stringify({ name, raceId, classId }),
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
  return request<{ scene: Scene; collectedLoot: unknown }>('/scene/move', {
    method: 'POST',
    body: JSON.stringify({ tokenId, x, y }),
  });
}

export function endTurn() {
  return request<Scene>('/scene/end-turn', { method: 'POST' });
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
