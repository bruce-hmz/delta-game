import { describe, it, expect } from "vitest";
import { generateMap } from "@/lib/game/extraction/map-generator";
import { ZONES } from "@/lib/game/extraction/zone-config";
import { seededRandom } from "@/lib/game/gacha-constants";

const HAWKEYE = ZONES.hawkeye_power;
const AURORA = ZONES.aurora_lab;

describe("Map generation", () => {
  it("produces a map with correct node count for zone config", () => {
    for (let i = 0; i < 20; i++) {
      const map = generateMap(HAWKEYE, `seed-${i}`);
      expect(map.nodes.length).toBeGreaterThanOrEqual(HAWKEYE.nodeCountRange[0]);
      expect(map.nodes.length).toBeLessThanOrEqual(HAWKEYE.nodeCountRange[1]);
    }
  });

  it("is deterministic with same seed", () => {
    const map1 = generateMap(AURORA, "deterministic-test");
    const map2 = generateMap(AURORA, "deterministic-test");
    expect(map1.nodes.map((n) => n.id)).toEqual(map2.nodes.map((n) => n.id));
    expect(map1.nodes.map((n) => n.type)).toEqual(map2.nodes.map((n) => n.type));
    expect(map1.nodes.map((n) => n.adjacentIds)).toEqual(
      map2.nodes.map((n) => n.adjacentIds)
    );
  });

  it("produces different maps with different seeds", () => {
    const map1 = generateMap(HAWKEYE, "seed-alpha");
    const map2 = generateMap(HAWKEYE, "seed-beta");
    expect(map1.nodes.map((n) => n.type)).not.toEqual(map2.nodes.map((n) => n.type));
  });

  it("start node is always revealed and of type loot", () => {
    for (let i = 0; i < 10; i++) {
      const map = generateMap(HAWKEYE, `start-test-${i}`);
      const startNode = map.nodes.find((n) => n.id === map.startNodeId)!;
      expect(startNode).toBeDefined();
      expect(startNode.type).toBe("loot");
      expect(startNode.revealed).toBe(true);
    }
  });

  it("at least one evac node exists", () => {
    for (let i = 0; i < 10; i++) {
      const map = generateMap(HAWKEYE, `evac-test-${i}`);
      const evacNodes = map.nodes.filter((n) => n.type === "evac");
      expect(evacNodes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("all nodes are reachable from start node (connected graph)", () => {
    for (let i = 0; i < 10; i++) {
      const map = generateMap(AURORA, `connect-test-${i}`);
      const visited = new Set<string>();
      const queue = [map.startNodeId];
      visited.add(map.startNodeId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const node = map.nodes.find((n) => n.id === current)!;
        for (const adjId of node.adjacentIds) {
          if (!visited.has(adjId)) {
            visited.add(adjId);
            queue.push(adjId);
          }
        }
      }

      expect(visited.size).toBe(map.nodes.length);
    }
  });

  it("each node has at least 1 and at most 4 adjacent nodes", () => {
    const map = generateMap(AURORA, "adj-count-test");
    for (const node of map.nodes) {
      expect(node.adjacentIds.length).toBeGreaterThanOrEqual(1);
      expect(node.adjacentIds.length).toBeLessThanOrEqual(4);
    }
  });

  it("node types include at least loot and evac", () => {
    const map = generateMap(HAWKEYE, "type-test");
    const types = new Set(map.nodes.map((n) => n.type));
    expect(types.has("loot")).toBe(true);
    expect(types.has("evac")).toBe(true);
  });

  it("adjacency is bidirectional", () => {
    const map = generateMap(AURORA, "bidir-test");
    const nodeMap = new Map(map.nodes.map((n) => [n.id, n]));
    for (const node of map.nodes) {
      for (const adjId of node.adjacentIds) {
        const adj = nodeMap.get(adjId);
        expect(adj).toBeDefined();
        expect(adj!.adjacentIds).toContain(node.id);
      }
    }
  });

  it("evac node is placed far from start (minimum 2 edges)", () => {
    for (let i = 0; i < 10; i++) {
      const map = generateMap(HAWKEYE, `dist-test-${i}`);
      // BFS from start to find distance to nearest evac
      const distances = new Map<string, number>();
      const queue = [map.startNodeId];
      distances.set(map.startNodeId, 0);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const dist = distances.get(current)!;
        const node = map.nodes.find((n) => n.id === current)!;
        for (const adjId of node.adjacentIds) {
          if (!distances.has(adjId)) {
            distances.set(adjId, dist + 1);
            queue.push(adjId);
          }
        }
      }

      const evacDistances = map.nodes
        .filter((n) => n.type === "evac")
        .map((n) => distances.get(n.id)!);
      const minEvacDist = Math.min(...evacDistances);
      expect(minEvacDist).toBeGreaterThanOrEqual(2);
    }
  });

  it("no node is adjacent to itself", () => {
    const map = generateMap(AURORA, "no-self-loop-test");
    for (const node of map.nodes) {
      expect(node.adjacentIds).not.toContain(node.id);
    }
  });
});
