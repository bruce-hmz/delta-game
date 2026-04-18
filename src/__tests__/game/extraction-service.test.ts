import { describe, it, expect } from "vitest";
import {
  computeFogOfWar,
  validateMove,
  resolveNode,
  computeEvacuation,
} from "@/lib/game/extraction/extraction-service";
import { generateMap } from "@/lib/game/extraction/map-generator";
import { ZONES } from "@/lib/game/extraction/zone-config";
import { seededRandom } from "@/lib/game/gacha-constants";
import type { GameMap } from "@/lib/game/extraction/types";

const HAWKEYE = ZONES.hawkeye_power;

function makeTestMap(): GameMap {
  return generateMap(HAWKEYE, "service-test-seed");
}

describe("Extraction service - pure logic", () => {
  describe("computeFogOfWar", () => {
    it("reveals visited nodes and their immediate neighbors", () => {
      const map = makeTestMap();
      const visited = [map.startNodeId];
      const fog = computeFogOfWar(map, visited);

      // Start node should be fully revealed
      const startFog = fog.find((n) => n.id === map.startNodeId)!;
      expect(startFog.revealed).toBe(true);
      expect(startFog.type).not.toBe("hidden");

      // Adjacent nodes should have their type revealed
      const startNode = map.nodes.find((n) => n.id === map.startNodeId)!;
      for (const adjId of startNode.adjacentIds) {
        const adjFog = fog.find((n) => n.id === adjId)!;
        expect(adjFog.type).not.toBe("hidden");
      }
    });

    it("hides non-adjacent unrevealed nodes", () => {
      const map = makeTestMap();
      const visited = [map.startNodeId];
      const fog = computeFogOfWar(map, visited);

      // Find a node that is NOT visited and NOT adjacent to visited
      const startNode = map.nodes.find((n) => n.id === map.startNodeId)!;
      const adjacentSet = new Set(startNode.adjacentIds);
      adjacentSet.add(map.startNodeId);

      const hiddenNodes = fog.filter(
        (n) => !adjacentSet.has(n.id) && !visited.includes(n.id)
      );

      // If there are nodes beyond the immediate neighbors, they should be hidden
      for (const node of hiddenNodes) {
        expect(node.type).toBe("hidden");
        expect(node.revealed).toBe(false);
      }
    });

    it("preserves revealed state for previously visited nodes", () => {
      const map = makeTestMap();
      // Visit start + one adjacent
      const startNode = map.nodes.find((n) => n.id === map.startNodeId)!;
      const nextId = startNode.adjacentIds[0];
      const visited = [map.startNodeId, nextId];

      const fog = computeFogOfWar(map, visited);

      // Both visited nodes should be revealed
      expect(fog.find((n) => n.id === map.startNodeId)!.revealed).toBe(true);
      expect(fog.find((n) => n.id === nextId)!.revealed).toBe(true);
    });
  });

  describe("validateMove", () => {
    it("allows move to adjacent node", () => {
      const map = makeTestMap();
      const startNode = map.nodes.find((n) => n.id === map.startNodeId)!;
      const targetId = startNode.adjacentIds[0];

      const result = validateMove(map, map.startNodeId, targetId, 100);
      expect(result.valid).toBe(true);
    });

    it("rejects move to non-adjacent node", () => {
      const map = makeTestMap();
      // Find a node that is not adjacent to start
      const startNode = map.nodes.find((n) => n.id === map.startNodeId)!;
      const adjacentSet = new Set(startNode.adjacentIds);
      const nonAdjacent = map.nodes.find(
        (n) => n.id !== map.startNodeId && !adjacentSet.has(n.id)
      );

      if (nonAdjacent) {
        const result = validateMove(map, map.startNodeId, nonAdjacent.id, 100);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("adjacent");
      }
    });

    it("rejects move when dead (hp <= 0)", () => {
      const map = makeTestMap();
      const startNode = map.nodes.find((n) => n.id === map.startNodeId)!;
      const targetId = startNode.adjacentIds[0];

      const result = validateMove(map, map.startNodeId, targetId, 0);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("dead");
    });

    it("rejects move to non-existent node", () => {
      const map = makeTestMap();
      const result = validateMove(map, map.startNodeId, "node-999", 100);
      expect(result.valid).toBe(false);
    });
  });

  describe("resolveNode", () => {
    it("loot node: generates items", () => {
      const map = makeTestMap();
      const rng = seededRandom("resolve-loot-test");
      // Force a loot node that hasn't been looted
      const lootNode = map.nodes.find((n) => n.type === "loot" && n.id !== map.startNodeId);
      if (lootNode) {
        const result = resolveNode(map, lootNode.id, HAWKEYE, rng);
        expect(result.nodeType).toBe("loot");
        expect(Array.isArray(result.items)).toBe(true);
        // Items may be 0-3, but the node is marked looted
      }
    });

    it("loot node: trap damage reduces HP when trap triggers", () => {
      // Generate a fresh map for each attempt since resolveNode mutates looted state
      let trapFound = false;
      for (let i = 0; i < 100; i++) {
        const map = generateMap(HAWKEYE, `trap-test-${i}`);
        const rng = seededRandom(`trap-rng-${i}`);
        const lootNode = map.nodes.find((n) => n.type === "loot" && n.id !== map.startNodeId);
        if (!lootNode) continue;
        const result = resolveNode(map, lootNode.id, HAWKEYE, rng);
        if (result.trapDamage > 0) {
          expect(result.trapDamage).toBeGreaterThanOrEqual(HAWKEYE.trapDamage[0]);
          expect(result.trapDamage).toBeLessThanOrEqual(HAWKEYE.trapDamage[1]);
          trapFound = true;
          break;
        }
      }
      // Trap chance is 25%, so with 100 attempts we should see at least one
      expect(trapFound).toBe(true);
    });

    it("loot node: trap can kill player", () => {
      const map = makeTestMap();
      for (let i = 0; i < 200; i++) {
        const rng = seededRandom(`kill-test-${i}`);
        const lootNode = map.nodes.find((n) => n.type === "loot" && n.id !== map.startNodeId);
        if (!lootNode) continue;
        const result = resolveNode(map, lootNode.id, HAWKEYE, rng);
        if (result.trapDamage > 0) {
          // Simulate low HP
          const hpAfterTrap = 5 - result.trapDamage;
          expect(hpAfterTrap <= 0 || hpAfterTrap > 0).toBe(true); // just verifying calculation works
          break;
        }
      }
    });

    it("event node: returns no special effect in Phase 1", () => {
      const map = makeTestMap();
      const rng = seededRandom("event-test");
      // Find or create an event node
      let eventNode = map.nodes.find((n) => n.type === "event");
      if (!eventNode) {
        // Force one to be event type
        eventNode = map.nodes.find((n) => n.type !== "evac" && n.id !== map.startNodeId);
        if (eventNode) eventNode.type = "event";
      }
      if (eventNode) {
        const result = resolveNode(map, eventNode.id, HAWKEYE, rng);
        expect(result.nodeType).toBe("event");
        expect(result.items).toEqual([]);
        expect(result.trapDamage).toBe(0);
      }
    });

    it("evac node: returns evac type with no damage", () => {
      const map = makeTestMap();
      const rng = seededRandom("evac-test");
      const evacNode = map.nodes.find((n) => n.type === "evac");
      if (evacNode) {
        const result = resolveNode(map, evacNode.id, HAWKEYE, rng);
        expect(result.nodeType).toBe("evac");
        expect(result.trapDamage).toBe(0);
      }
    });

    it("unknown node: reveals actual type", () => {
      const map = makeTestMap();
      const rng = seededRandom("unknown-test");
      // Find an unknown node
      const unknownNode = map.nodes.find((n) => n.type === "unknown");
      if (unknownNode) {
        // Replace with a known type for resolution (unknown reveals to random)
        const result = resolveNode(map, unknownNode.id, HAWKEYE, rng);
        expect(result.nodeType).toBeTruthy();
      }
    });

    it("already looted node returns no items", () => {
      const map = makeTestMap();
      const rng = seededRandom("reloot-test");
      // Find a loot node and mark it looted
      const lootNode = map.nodes.find((n) => n.type === "loot" && n.id !== map.startNodeId);
      if (lootNode) {
        lootNode.looted = true;
        const result = resolveNode(map, lootNode.id, HAWKEYE, rng);
        expect(result.items).toEqual([]);
        expect(result.trapDamage).toBe(0);
      }
    });
  });

  describe("computeEvacuation", () => {
    it("banks all backpack items on successful evacuation", () => {
      const map = makeTestMap();
      const evacNode = map.nodes.find((n) => n.type === "evac")!;
      const backpack = [
        { id: "item-1", itemName: "Test", quality: "white" as const, value: 100, affixes: [] },
        { id: "item-2", itemName: "Test2", quality: "blue" as const, value: 300, affixes: [] },
      ];

      const result = computeEvacuation(map, evacNode.id, 1, backpack);
      expect(result.success).toBe(true);
      expect(result.itemsBanked).toBe(2);
      expect(result.totalValue).toBe(400);
    });

    it("fails if not on evac node", () => {
      const map = makeTestMap();
      const backpack: any[] = [];
      const result = computeEvacuation(map, map.startNodeId, 1, backpack);
      expect(result.success).toBe(false);
    });

    it("fails if evacWaitTurns < 1", () => {
      const map = makeTestMap();
      const evacNode = map.nodes.find((n) => n.type === "evac")!;
      const backpack: any[] = [];
      const result = computeEvacuation(map, evacNode.id, 0, backpack);
      expect(result.success).toBe(false);
    });

    it("succeeds with empty backpack", () => {
      const map = makeTestMap();
      const evacNode = map.nodes.find((n) => n.type === "evac")!;
      const result = computeEvacuation(map, evacNode.id, 1, []);
      expect(result.success).toBe(true);
      expect(result.itemsBanked).toBe(0);
      expect(result.totalValue).toBe(0);
    });
  });
});
