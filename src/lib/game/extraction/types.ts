import type { GachaQuality } from "@/lib/game/gacha-constants";

// ──────────────────────────────────────────────
// Node & Map Types
// ──────────────────────────────────────────────

export type NodeType = "loot" | "event" | "evac" | "unknown";

export interface MapNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  adjacentIds: string[];
  revealed: boolean;
  looted: boolean;
}

export interface GameMap {
  nodes: MapNode[];
  startNodeId: string;
}

export interface FogOfWarNode {
  id: string;
  type: NodeType | "hidden";
  x: number;
  y: number;
  adjacentIds: string[];
  revealed: boolean;
  looted: boolean;
}

// ──────────────────────────────────────────────
// Zone Configuration
// ──────────────────────────────────────────────

export type ZoneDifficulty = "low" | "medium" | "high" | "extreme";

export interface ZoneConfig {
  id: string;
  name: string;
  difficulty: ZoneDifficulty;
  nodeCountRange: [number, number];
  dropRates: Record<GachaQuality, number>;
  trapChance: number;
  trapDamage: [number, number];
  evacCount: number;
}

// ──────────────────────────────────────────────
// Run State & Items
// ──────────────────────────────────────────────

export interface RunItem {
  id: string;
  itemName: string;
  quality: GachaQuality;
  value: number;
  affixes: Array<{ type: string; description: string }>;
}

export interface RunState {
  runId: string;
  playerId: string;
  zoneId: string;
  currentNodeId: string;
  hp: number;
  maxHp: number;
  backpack: RunItem[];
  backpackCapacity: number;
  evacWaitTurns: number;
}

// ──────────────────────────────────────────────
// Action Results
// ──────────────────────────────────────────────

export interface MoveResult {
  newNodeId: string;
  nodeType: NodeType;
  items: RunItem[];
  trapDamage: number;
  hp: number;
  gameOver: boolean;
  map: FogOfWarNode[];
}

export interface EvacResult {
  success: boolean;
  itemsBanked: number;
  totalValue: number;
}
