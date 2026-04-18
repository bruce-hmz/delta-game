import { seededRandom } from "@/lib/game/gacha-constants";
import type { ZoneConfig } from "./types";
import type { GameMap, MapNode, NodeType } from "./types";

/**
 * Generate a deterministic map for the given zone and seed.
 * Uses a spanning tree for guaranteed connectivity + random extra edges.
 */
export function generateMap(zone: ZoneConfig, seed: string): GameMap {
  const rng = seededRandom(seed);

  // 1. Determine node count
  const [minNodes, maxNodes] = zone.nodeCountRange;
  const nodeCount = minNodes + Math.floor(rng() * (maxNodes - minNodes + 1));

  // 2. Create nodes with IDs
  const nodes: MapNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    // Distribute nodes on a grid for approximate positions
    const cols = Math.ceil(Math.sqrt(nodeCount));
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = col / Math.max(cols - 1, 1);
    const y = row / Math.max(Math.ceil(nodeCount / cols) - 1, 1);

    nodes.push({
      id: `node-${i}`,
      type: "unknown", // assigned later
      x,
      y,
      adjacentIds: [],
      revealed: false,
      looted: false,
    });
  }

  // 3. Build spanning tree (Prim's algorithm) for guaranteed connectivity
  const inTree = new Set<number>([0]);
  const candidates: Array<{ from: number; to: number }> = [];

  // Add edges from node 0 to its neighbors
  addCandidates(0, nodeCount, candidates, inTree);

  while (inTree.size < nodeCount && candidates.length > 0) {
    // Pick a random candidate
    const idx = Math.floor(rng() * candidates.length);
    const edge = candidates[idx];
    candidates.splice(idx, 1);

    if (inTree.has(edge.to)) continue;

    // Add bidirectional edge
    nodes[edge.from].adjacentIds.push(nodes[edge.to].id);
    nodes[edge.to].adjacentIds.push(nodes[edge.from].id);
    inTree.add(edge.to);

    addCandidates(edge.to, nodeCount, candidates, inTree);
  }

  // 4. Add random extra edges (up to ~30% of nodes get one extra connection)
  for (let i = 0; i < nodeCount; i++) {
    if (nodes[i].adjacentIds.length >= 4) continue;
    if (rng() > 0.3) continue;

    // Try to connect to a non-adjacent node within 2 grid steps
    const possibleTargets: number[] = [];
    for (let j = 0; j < nodeCount; j++) {
      if (i === j) continue;
      if (nodes[j].adjacentIds.length >= 4) continue;
      if (nodes[i].adjacentIds.includes(nodes[j].id)) continue;

      // Check grid proximity (within ~2 steps)
      const dx = Math.abs(nodes[i].x - nodes[j].x);
      const dy = Math.abs(nodes[i].y - nodes[j].y);
      if (dx <= 0.4 && dy <= 0.4) {
        possibleTargets.push(j);
      }
    }

    if (possibleTargets.length > 0) {
      const target = possibleTargets[Math.floor(rng() * possibleTargets.length)];
      nodes[i].adjacentIds.push(nodes[target].id);
      nodes[target].adjacentIds.push(nodes[i].id);
    }
  }

  // 5. Assign node types
  // Start node is always loot
  nodes[0].type = "loot";
  nodes[0].revealed = true;

  // Place evac nodes far from start
  const evacPositions = selectEvacPositions(nodes, zone.evacCount, rng);
  for (const pos of evacPositions) {
    nodes[pos].type = "evac";
  }

  // Assign remaining nodes: weighted random types
  const typeWeights: Array<[NodeType, number]> = [
    ["loot", 0.45],
    ["event", 0.25],
    ["unknown", 0.30],
  ];

  for (let i = 1; i < nodeCount; i++) {
    if (nodes[i].type !== "unknown") continue; // already assigned (evac)
    const roll = rng();
    let cumulative = 0;
    for (const [type, weight] of typeWeights) {
      cumulative += weight;
      if (roll < cumulative) {
        nodes[i].type = type;
        break;
      }
    }
  }

  return { nodes, startNodeId: "node-0" };
}

/**
 * Add candidate edges from a node to its grid neighbors.
 */
function addCandidates(
  nodeIdx: number,
  totalNodes: number,
  candidates: Array<{ from: number; to: number }>,
  inTree: Set<number>
): void {
  const cols = Math.ceil(Math.sqrt(totalNodes));
  const row = Math.floor(nodeIdx / cols);
  const col = nodeIdx % cols;

  // Right neighbor
  if (col + 1 < cols && nodeIdx + 1 < totalNodes && !inTree.has(nodeIdx + 1)) {
    candidates.push({ from: nodeIdx, to: nodeIdx + 1 });
  }
  // Down neighbor
  if (nodeIdx + cols < totalNodes && !inTree.has(nodeIdx + cols)) {
    candidates.push({ from: nodeIdx, to: nodeIdx + cols });
  }
  // Left neighbor
  if (col - 1 >= 0 && !inTree.has(nodeIdx - 1)) {
    candidates.push({ from: nodeIdx, to: nodeIdx - 1 });
  }
  // Up neighbor
  if (nodeIdx - cols >= 0 && !inTree.has(nodeIdx - cols)) {
    candidates.push({ from: nodeIdx, to: nodeIdx - cols });
  }
}

/**
 * Select evac node positions far from start using BFS distances.
 */
function selectEvacPositions(
  nodes: MapNode[],
  count: number,
  rng: () => number
): number[] {
  // Compute BFS distances from start (node-0)
  const distances = new Map<number, number>();
  const queue = [0];
  distances.set(0, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dist = distances.get(current)!;
    const node = nodes[current];
    for (const adjId of node.adjacentIds) {
      const adjIdx = parseInt(adjId.split("-")[1]);
      if (!distances.has(adjIdx)) {
        distances.set(adjIdx, dist + 1);
        queue.push(adjIdx);
      }
    }
  }

  // Sort nodes by distance descending (prefer far nodes)
  const sortedByDist = Array.from(distances.entries())
    .filter(([idx]) => idx !== 0) // exclude start
    .sort((a, b) => b[1] - a[1]);

  const selected: number[] = [];
  for (const [idx] of sortedByDist) {
    if (selected.length >= count) break;
    // Don't pick nodes adjacent to already-selected evac nodes
    const isNearSelected = selected.some(
      (s) =>
        nodes[s].adjacentIds.includes(nodes[idx].id) ||
        nodes[idx].adjacentIds.includes(nodes[s].id)
    );
    if (!isNearSelected || sortedByDist.length - selected.length <= count) {
      selected.push(idx);
    }
  }

  return selected;
}
