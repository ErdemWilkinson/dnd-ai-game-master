export interface Attributes {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  equipped: boolean;
}

export interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  hp: { current: number; max: number };
  mana: { current: number; max: number };
  attributes: Attributes;
  inventory: InventoryItem[];
}

export interface RaceOption {
  id: string;
  name: string;
  attributeBonuses: Partial<Attributes>;
}

export interface ClassOption {
  id: string;
  name: string;
  baseHp: number;
  baseMana: number;
  primaryAttribute: keyof Attributes;
  startingInventory: string[];
}

export interface ChatMessage {
  id: string;
  role: 'player' | 'gm';
  text: string;
  source?: 'ai' | 'mock';
  timestamp: number;
}

export interface SceneToken {
  id: string;
  type: 'player' | 'enemy';
  name: string;
  x: number;
  y: number;
  speed: number;
}

export interface SceneLoot {
  id: string;
  x: number;
  y: number;
  name: string;
}

export interface Scene {
  id: string;
  name: string;
  width: number;
  height: number;
  round: number;
  activeTokenId: string;
  obstacles: { x: number; y: number }[];
  loot: SceneLoot[];
  tokens: SceneToken[];
}
