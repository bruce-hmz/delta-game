import { seededRandom } from "@/lib/game/gacha-constants";
import * as crypto from "crypto";
import { getDrizzleClient } from "@/storage/database/drizzle-client";
import { runs, runInventory } from "@/storage/database/shared/schema";
import { eq, and } from "drizzle-orm";
import { generateMap } from "./map-generator";
import { generateLootForNode } from "./loot-generator";
import { ZONES } from "./zone-config";
import type {
  GameMap,
  FogOfWarNode,
  NodeType,
  RunItem,
  RunState,
  ZoneConfig,
  EvacResult,
  MoveResult,
  MapNode,
} from "./types";

// ──────────────────────────────────────────────
// Fog of War
// ──────────────────────────────────────────────

/**
 * Compute the fog-of-war view for the client.
 * Visited nodes: fully revealed.
 * Adjacent-to-visited nodes: type revealed but not visited.
 * All others: type = "hidden".
 */
export function computeFogOfWar(
  map: GameMap,
  visitedNodeIds: string[]
): FogOfWarNode[] {
  const visitedSet = new Set(visitedNodeIds);

  // Collect all nodes adjacent to visited nodes
  const adjacentToVisited = new Set<string>();
  for (const id of visitedSet) {
    const node = map.nodes.find((n) => n.id === id);
    if (node) {
      for (const adjId of node.adjacentIds) {
        adjacentToVisited.add(adjId);
      }
    }
  }

  return map.nodes.map((node) => {
    if (visitedSet.has(node.id)) {
      // Visited: fully revealed
      return {
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        adjacentIds: node.adjacentIds,
        revealed: true,
        looted: node.looted,
      };
    } else if (adjacentToVisited.has(node.id)) {
      // Adjacent to visited: type revealed but not visited
      return {
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        adjacentIds: node.adjacentIds,
        revealed: false,
        looted: false,
      };
    } else {
      // Hidden
      return {
        id: node.id,
        type: "hidden" as const,
        x: node.x,
        y: node.y,
        adjacentIds: node.adjacentIds,
        revealed: false,
        looted: false,
      };
    }
  });
}

// ──────────────────────────────────────────────
// Move Validation
// ──────────────────────────────────────────────

export function validateMove(
  map: GameMap,
  currentNodeId: string,
  targetNodeId: string,
  hp: number
): { valid: boolean; reason?: string } {
  if (hp <= 0) {
    return { valid: false, reason: "Player is dead" };
  }

  const currentNode = map.nodes.find((n) => n.id === currentNodeId);
  if (!currentNode) {
    return { valid: false, reason: "Current node not found" };
  }

  const targetNode = map.nodes.find((n) => n.id === targetNodeId);
  if (!targetNode) {
    return { valid: false, reason: "Target node not found" };
  }

  if (!currentNode.adjacentIds.includes(targetNodeId)) {
    // Allow self-move (loot current node)
    if (currentNodeId !== targetNodeId) {
      return { valid: false, reason: "Target node is not adjacent" };
    }
  }

  return { valid: true };
}

// ──────────────────────────────────────────────
// Node Resolution
// ──────────────────────────────────────────────

export function resolveNode(
  map: GameMap,
  nodeId: string,
  zone: ZoneConfig,
  rng: () => number
): { items: RunItem[]; trapDamage: number; nodeType: NodeType } {
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return { items: [], trapDamage: 0, nodeType: "unknown" };
  }

  // Already looted nodes yield nothing
  if (node.looted) {
    return { items: [], trapDamage: 0, nodeType: node.type };
  }

  const result: { items: RunItem[]; trapDamage: number; nodeType: NodeType } = {
    items: [],
    trapDamage: 0,
    nodeType: node.type,
  };

  switch (node.type) {
    case "loot":
      result.items = generateLootForNode(zone, nodeId, rng);
      // Trap chance
      if (rng() < zone.trapChance) {
        const [minDmg, maxDmg] = zone.trapDamage;
        result.trapDamage =
          minDmg + Math.floor(rng() * (maxDmg - minDmg + 1));
      }
      node.looted = true;
      break;

    case "event":
      // Phase 1: events are no-ops
      node.looted = true;
      break;

    case "evac":
      // Evac nodes are safe, no loot, no traps
      node.looted = true;
      break;

    case "unknown":
      // Reveal to a random type
      const typeRoll = rng();
      if (typeRoll < 0.5) {
        node.type = "loot";
      } else if (typeRoll < 0.8) {
        node.type = "event";
      } else {
        node.type = "loot";
      }
      result.nodeType = node.type;

      // Resolve the revealed type
      if (node.type === "loot") {
        result.items = generateLootForNode(zone, nodeId, rng);
        if (rng() < zone.trapChance) {
          const [minDmg, maxDmg] = zone.trapDamage;
          result.trapDamage =
            minDmg + Math.floor(rng() * (maxDmg - minDmg + 1));
        }
      }
      node.looted = true;
      break;
  }

  return result;
}

// ──────────────────────────────────────────────
// Evacuation
// ──────────────────────────────────────────────

export function computeEvacuation(
  map: GameMap,
  currentNodeId: string,
  evacWaitTurns: number,
  backpack: RunItem[]
): EvacResult {
  const currentNode = map.nodes.find((n) => n.id === currentNodeId);

  if (!currentNode || currentNode.type !== "evac") {
    return { success: false, itemsBanked: 0, totalValue: 0 };
  }

  if (evacWaitTurns < 1) {
    return { success: false, itemsBanked: 0, totalValue: 0 };
  }

  const totalValue = backpack.reduce((sum, item) => sum + item.value, 0);

  return {
    success: true,
    itemsBanked: backpack.length,
    totalValue,
  };
}

// ──────────────────────────────────────────────
// DB Operations
// ──────────────────────────────────────────────

/**
 * Start a new run. Generates map, checks for existing active run.
 */
export async function startRun(
  playerId: string,
  zoneId: string
): Promise<RunState> {
  const db = getDrizzleClient();
  const zone = ZONES[zoneId];
  if (!zone) {
    throw new Error("invalid_zone");
  }

  // Check for existing active run
  const existing = await db
    .select()
    .from(runs)
    .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("active_run_exists");
  }

  // Generate map
  const seed = `${playerId}-${crypto.randomUUID()}`;
  const map = generateMap(zone, seed);

  // Insert run
  const inserted = await db
    .insert(runs)
    .values({
      playerId,
      zoneId,
      mapData: map as any,
      currentNodeId: map.startNodeId,
      visitedNodeIds: [map.startNodeId],
      seed,
    })
    .returning();

  const run = inserted[0];

  return {
    runId: run.id,
    playerId: run.playerId,
    zoneId: run.zoneId,
    currentNodeId: run.currentNodeId,
    hp: run.hp,
    maxHp: run.maxHp,
    backpack: [],
    backpackCapacity: run.backpackCapacity,
    evacWaitTurns: run.evacWaitTurns,
  };
}

/**
 * Move player to an adjacent node. Validates, resolves node, updates state.
 */
export async function moveNode(
  playerId: string,
  targetNodeId: string
): Promise<MoveResult> {
  const db = getDrizzleClient();

  // Load active run
  const runRows = await db
    .select()
    .from(runs)
    .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
    .limit(1);

  if (runRows.length === 0) {
    throw new Error("no_active_run");
  }

  const run = runRows[0];
  const map = run.mapData as unknown as GameMap;
  const zone = ZONES[run.zoneId];

  // Validate move
  const validation = validateMove(map, run.currentNodeId, targetNodeId, run.hp);
  if (!validation.valid) {
    throw new Error(validation.reason || "invalid_move");
  }

  // Resolve node
  const rng = seededRandom(`${run.seed}-${targetNodeId}`);
  const resolution = resolveNode(map, targetNodeId, zone, rng);

  // Calculate new HP
  const newHp = Math.max(0, run.hp - resolution.trapDamage);
  const gameOver = newHp <= 0;

  // Update visited nodes
  const visited = (run.visitedNodeIds as string[]) || [];
  if (!visited.includes(targetNodeId)) {
    visited.push(targetNodeId);
  }

  // Update evac wait counter
  const targetNode = map.nodes.find((n) => n.id === targetNodeId);
  const newEvacWait =
    targetNode?.type === "evac" ? run.evacWaitTurns + 1 : 0;

  // Update run in DB
  await db
    .update(runs)
    .set({
      currentNodeId: targetNodeId,
      visitedNodeIds: visited,
      hp: newHp,
      evacWaitTurns: newEvacWait,
      status: gameOver ? "dead" : "active",
      completedAt: gameOver ? new Date() : null,
      mapData: map as any,
    })
    .where(eq(runs.id, run.id));

  // Insert inventory items (respecting backpack capacity)
  const currentItemCount = await db
    .select({ count: runInventory.id })
    .from(runInventory)
    .where(eq(runInventory.runId, run.id))
    .then(rows => rows.length);

  const slotsLeft = run.backpackCapacity - currentItemCount;
  const itemsToInsert = resolution.items.slice(0, Math.max(0, slotsLeft));

  for (const item of itemsToInsert) {
    await db.insert(runInventory).values({
      runId: run.id,
      itemName: item.itemName,
      quality: item.quality,
      value: item.value,
      affixes: item.affixes,
      sourceNodeId: targetNodeId,
    });
  }

  // Load full backpack
  const inventoryRows = await db
    .select()
    .from(runInventory)
    .where(eq(runInventory.runId, run.id));

  const backpack: RunItem[] = inventoryRows.map((r) => ({
    id: r.id,
    itemName: r.itemName,
    quality: r.quality as any,
    value: r.value,
    affixes: (r.affixes as any) || [],
  }));

  // Fog of war
  const fogMap = computeFogOfWar(map, visited);

  return {
    newNodeId: targetNodeId,
    nodeType: resolution.nodeType,
    items: resolution.items,
    trapDamage: resolution.trapDamage,
    hp: newHp,
    gameOver,
    map: fogMap,
  };
}

/**
 * Attempt evacuation from current position.
 */
export async function evacuateRun(playerId: string): Promise<EvacResult> {
  const db = getDrizzleClient();

  const runRows = await db
    .select()
    .from(runs)
    .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
    .limit(1);

  if (runRows.length === 0) {
    throw new Error("no_active_run");
  }

  const run = runRows[0];
  const map = run.mapData as unknown as GameMap;

  // Load backpack
  const inventoryRows = await db
    .select()
    .from(runInventory)
    .where(eq(runInventory.runId, run.id));

  const backpack: RunItem[] = inventoryRows.map((r) => ({
    id: r.id,
    itemName: r.itemName,
    quality: r.quality as any,
    value: r.value,
    affixes: (r.affixes as any) || [],
  }));

  const result = computeEvacuation(
    map,
    run.currentNodeId,
    run.evacWaitTurns,
    backpack
  );

  if (result.success) {
    // Mark run as completed
    await db
      .update(runs)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(runs.id, run.id));

    // Clear inventory (items are "banked" conceptually)
    await db.delete(runInventory).where(eq(runInventory.runId, run.id));
  }

  return result;
}

/**
 * Get active run for a player, if any.
 */
export async function getActiveRun(
  playerId: string
): Promise<RunState | null> {
  const db = getDrizzleClient();

  const runRows = await db
    .select()
    .from(runs)
    .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
    .limit(1);

  if (runRows.length === 0) return null;

  const run = runRows[0];

  // Load backpack
  const inventoryRows = await db
    .select()
    .from(runInventory)
    .where(eq(runInventory.runId, run.id));

  return {
    runId: run.id,
    playerId: run.playerId,
    zoneId: run.zoneId,
    currentNodeId: run.currentNodeId,
    hp: run.hp,
    maxHp: run.maxHp,
    backpack: inventoryRows.map((r) => ({
      id: r.id,
      itemName: r.itemName,
      quality: r.quality as any,
      value: r.value,
      affixes: (r.affixes as any) || [],
    })),
    backpackCapacity: run.backpackCapacity,
    evacWaitTurns: run.evacWaitTurns,
  };
}
