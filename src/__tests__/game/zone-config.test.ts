import { describe, it, expect } from "vitest";
import { ZONES, ZONE_IDS } from "@/lib/game/extraction/zone-config";
import type { GachaQuality } from "@/lib/game/gacha-constants";

describe("Zone configuration", () => {
  it("defines all 4 zones with required fields", () => {
    expect(ZONE_IDS).toHaveLength(4);
    for (const id of ZONE_IDS) {
      const zone = ZONES[id];
      expect(zone).toBeDefined();
      expect(zone.id).toBe(id);
      expect(zone.name).toBeTruthy();
      expect(zone.difficulty).toBeTruthy();
      expect(zone.nodeCountRange).toHaveLength(2);
      expect(zone.dropRates).toBeDefined();
      expect(zone.trapDamage).toHaveLength(2);
      expect(zone.evacCount).toBeGreaterThan(0);
    }
  });

  it("each zone has node count range within valid bounds", () => {
    for (const id of ZONE_IDS) {
      const zone = ZONES[id];
      const [min, max] = zone.nodeCountRange;
      expect(min).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThanOrEqual(5);
      expect(max).toBeLessThanOrEqual(20);
    }
  });

  it("each zone has valid drop rates that sum to 1.0", () => {
    const qualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];
    for (const id of ZONE_IDS) {
      const zone = ZONES[id];
      const sum = qualities.reduce((acc, q) => acc + (zone.dropRates[q] ?? 0), 0);
      expect(sum).toBeCloseTo(1.0, 5);
      for (const q of qualities) {
        expect(zone.dropRates[q]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("zone IDs are stable string constants", () => {
    expect(ZONE_IDS).toEqual([
      "hawkeye_power",
      "zero_dam",
      "black_hawk",
      "aurora_lab",
    ]);
  });
});
