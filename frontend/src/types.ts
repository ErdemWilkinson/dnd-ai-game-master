export interface Attributes {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type EquipmentSlot =
  | 'head'
  | 'mask'
  | 'glasses'
  | 'ears'
  | 'neck'
  | 'back'
  | 'suit'
  | 'under'
  | 'gloves'
  | 'belt'
  | 'shoes'
  | 'accessories'
  | 'hand';

export interface InventoryItem {
  id: string;
  name: string;
  equipped: boolean;
  slot: EquipmentSlot | null;
  icon: string | null;
}

export interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  appearance: string | null;
  level: number;
  xp: number;
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

export interface AppearanceOption {
  id: string;
  name: string;
  description: string;
}

export interface ActionRoll {
  attribute: keyof Attributes;
  roll: number;
  modifier: number;
  total: number;
  dc: number;
  outcome: 'critical-success' | 'success' | 'failure' | 'critical-failure';
}

export interface ChatMessage {
  id: string;
  role: 'player' | 'gm';
  text: string;
  source?: 'ai' | 'mock';
  roll?: ActionRoll;
  timestamp: number;
}

export interface SceneToken {
  id: string;
  type: 'player' | 'enemy';
  name: string;
  x: number;
  y: number;
  speed: number;
  movementLeft: number;
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  hp?: number;
  maxHp?: number;
}

export interface SceneLoot {
  id: string;
  x: number;
  y: number;
  name: string;
}

export type SpellId = 'fireball' | 'heal';

export interface Scene {
  id: string;
  name: string;
  width: number;
  height: number;
  round: number;
  activeTokenId: string;
  encounterIndex: number;
  totalEncounters: number;
  obstacles: { x: number; y: number }[];
  loot: SceneLoot[];
  tokens: SceneToken[];
}
