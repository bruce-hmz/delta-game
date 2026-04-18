import { describe, it, expect } from "vitest";
import { generateLootForNode } from "@/lib/game/extraction/loot-generator";
import { ZONES } from "@/lib/game/extraction/zone-config";
import { seededRandom } from "@/lib/game/gacha-constants";
import type { GachaQuality } from "@/lib/game/gacha-constants";
import { ITEM_NAMES, VALUE_RANGES } from "@/lib/game/gacha-constants";

const HAWKEYE = ZONES.hawkeye_power;

describe("Loot generation for extraction", () => {
  it("generates items using zone drop rates", () => {
    const rng = seededRandom("loot-dist-test");
    const qualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];
    const counts: Record<GachaQuality, number> = { white: 0, blue: 0, purple: 0, red: 0, gold: 0 };

    for (let i = 0; i < 500; i++) {
      const items = generateLootForNode(HAWKEYE, `node-${i}`, rng);
      for (const item of items) {
        counts[item.quality]++;
      }
    }

    // Hawkeye is white/blue dominant
    expect(counts.white + counts.blue).toBeGreaterThan(counts.purple + counts.red + counts.gold);
  });

  it("produces items with valid quality values", () => {
    const rng = seededRandom("loot-quality-test");
    const validQualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];

    for (let i = 0; i < 100; i++) {
      const items = generateLootForNode(HAWKEYE, `node-${i}`, rng);
      for (const item of items) {
        expect(validQualities).toContain(item.quality);
      }
    }
  });

  it("assigns a unique ID to each generated item", () => {
    const rng = seededRandom("loot-id-test");
    const allIds = new Set<string>();

    for (let i = 0; i < 50; i++) {
      const items = generateLootForNode(HAWKEYE, `node-${i}`, rng);
      for (const item of items) {
        expect(allIds.has(item.id)).toBe(false);
        allIds.add(item.id);
      }
    }
  });

  it("reuses item names from gacha ITEM_NAMES", () => {
    const rng = seededRandom("loot-names-test");
    const allNames = new Set<string>();
    for (const q of ["white", "blue", "purple", "red", "gold"] as GachaQuality[]) {
      for (const name of ITEM_NAMES[q]) {
        allNames.add(name);
      }
    }

    for (let i = 0; i < 100; i++) {
      const items = generateLootForNode(HAWKEYE, `node-${i}`, rng);
      for (const item of items) {
        expect(allNames).toContain(item.itemName);
      }
    }
  });

  it("value ranges match quality tier VALUE_RANGES", () => {
    const rng = seededRandom("loot-value-test");

    for (let i = 0; i < 200; i++) {
      const items = generateLootForNode(HAWKEYE, `node-${i}`, rng);
      for (const item of items) {
        const [minVal, maxVal] = VALUE_RANGES[item.quality];
        expect(item.value).toBeGreaterThanOrEqual(minVal);
        expect(item.value).toBeLessThanOrEqual(maxVal);
      }
    }
  });

  it("is deterministic with same seed", () => {
    const rng1 = seededRandom("det-test");
    const rng2 = seededRandom("det-test");

    for (let i = 0; i < 20; i++) {
      const items1 = generateLootForNode(HAWKEYE, `node-${i}`, rng1);
      const items2 = generateLootForNode(HAWKEYE, `node-${i}`, rng2);
      expect(items1).toEqual(items2);
    }
  });

  it("can generate 0-3 items per node", () => {
    const rng = seededRandom("loot-count-test");
    const counts = new Set<number>();

    for (let i = 0; i < 200; i++) {
      const items = generateLootForNode(HAWKEYE, `node-${i}`, rng);
      counts.add(items.length);
      expect(items.length).toBeGreaterThanOrEqual(0);
      expect(items.length).toBeLessThanOrEqual(3);
    }

    // Should have at least 2 different counts (0 and 1+)
    expect(counts.size).toBeGreaterThanOrEqual(2);
  });

  it("affix structure matches expected format", () => {
    const rng = seededRandom("loot-affix-test");

    for (let i = 0; i < 100; i++) {
      const items = generateLootForNode(HAWKEYE, `node-${i}`, rng);
      for (const item of items) {
        expect(Array.isArray(item.affixes)).toBe(true);
        for (const affix of item.affixes) {
          expect(affix).toHaveProperty("type");
          expect(affix).toHaveProperty("description");
          expect(typeof affix.type).toBe("string");
          expect(typeof affix.description).toBe("string");
        }
      }
    }
  });
});
