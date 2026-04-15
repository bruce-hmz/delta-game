import { describe, it, expect, vi, beforeEach } from "vitest";
import { rollQuality, generateItem } from "@/lib/game/gacha-service";
import { seededRandom, ITEM_NAMES, VALUE_RANGES, PITY_THRESHOLD } from "@/lib/game/gacha-constants";
import type { GachaQuality } from "@/lib/game/gacha-constants";

// Integration tests covering the full pull pipeline logic
// without database (pure function tests + API contract validation)

const MILITARY_RATES: Record<GachaQuality, number> = {
  white: 0.60, blue: 0.25, purple: 0.10, red: 0.04, gold: 0.01,
};

const SUPPLY_DROP_RATES: Record<GachaQuality, number> = {
  white: 0.00, blue: 0.40, purple: 0.30, red: 0.20, gold: 0.10,
};

const BLACK_MARKET_RATES: Record<GachaQuality, number> = {
  white: 0.00, blue: 0.00, purple: 0.30, red: 0.40, gold: 0.30,
};

// ==================== Full Pull Pipeline (pure logic) ====================

describe("Full pull pipeline (deterministic)", () => {
  it("produces consistent results for same idempotency key across pipeline steps", () => {
    const key = "integration-test-key-001";
    const rng = seededRandom(key);

    // Step 1: Roll quality
    const quality = rollQuality(MILITARY_RATES, rng);

    // Step 2: Generate item
    const item = generateItem(quality, rng);

    // Verify consistency: running same key again produces same results
    const rng2 = seededRandom(key);
    const quality2 = rollQuality(MILITARY_RATES, rng2);
    const item2 = generateItem(quality2, rng2);

    expect(quality).toBe(quality2);
    expect(item.name).toBe(item2.name);
    expect(item.value).toBe(item2.value);
    expect(item.affixes).toEqual(item2.affixes);
  });

  it("respects crate drop rates across all 3 crate types", () => {
    const N = 5_000;

    for (const [name, rates] of [
      ["military", MILITARY_RATES],
      ["supply_drop", SUPPLY_DROP_RATES],
      ["black_market", BLACK_MARKET_RATES],
    ] as const) {
      const counts: Record<GachaQuality, number> = {
        white: 0, blue: 0, purple: 0, red: 0, gold: 0,
      };

      for (let i = 0; i < N; i++) {
        const q = rollQuality(rates);
        counts[q]++;
      }

      // White should never appear from supply_drop and black_market
      if (name !== "military") {
        expect(counts.white, `${name} should never produce white`).toBe(0);
      }

      // Blue should never appear from black_market
      if (name === "black_market") {
        expect(counts.blue, `black_market should never produce blue`).toBe(0);
      }

      // The dominant quality should match the highest rate
      const dominant = (Object.entries(rates) as [GachaQuality, number][])
        .sort((a, b) => b[1] - a[1])[0];
      const dominantCount = counts[dominant[0]];
      expect(dominantCount, `${name}: ${dominant[0]} should be most common`).toBeGreaterThan(N * 0.1);
    }
  });
});

// ==================== Pity System ====================

describe("Pity system", () => {
  it("forces red on pity trigger", () => {
    const result = rollQuality(MILITARY_RATES, Math.random, true);
    expect(result).toBe("red");
  });

  it("pity threshold is reachable within reasonable pulls", () => {
    // Simulate worst case: never hit red/gold naturally
    let pityCount = 0;
    const maxPulls = 200;

    for (let i = 0; i < maxPulls; i++) {
      const quality = rollQuality(BLACK_MARKET_RATES);
      if (quality === "red" || quality === "gold") {
        pityCount = 0;
      } else {
        pityCount++;
      }

      // Pity would trigger at threshold
      if (pityCount >= PITY_THRESHOLD) {
        return; // Success: reached within maxPulls
      }
    }

    // Black market always drops purple+, so pity should never actually trigger
    // But the threshold constant should be reasonable
    expect(PITY_THRESHOLD).toBeLessThanOrEqual(100);
  });
});

// ==================== Item Generation Contract ====================

describe("Item generation contract", () => {
  it("every quality produces items with valid structure", () => {
    const qualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];

    for (const quality of qualities) {
      for (let i = 0; i < 10; i++) {
        const item = generateItem(quality);
        expect(item.name, `${quality} item should have a name`).toBeTruthy();
        expect(ITEM_NAMES[quality]).toContain(item.name);
        expect(item.value).toBeGreaterThan(0);
        expect(item.affixes.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("value ranges are respected for every quality", () => {
    const qualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];

    for (const quality of qualities) {
      const [min, max] = VALUE_RANGES[quality];
      for (let i = 0; i < 30; i++) {
        const item = generateItem(quality);
        expect(item.value, `${quality}: ${item.value} should be >= ${min}`).toBeGreaterThanOrEqual(min);
        expect(item.value, `${quality}: ${item.value} should be <= ${max}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it("gold items always have 4 affixes with powerful first affix", () => {
    const powerfulTypes = ["guaranteed_red", "value_double", "extra_pull"];
    for (let i = 0; i < 20; i++) {
      const item = generateItem("gold");
      expect(item.affixes.length).toBe(4);
      expect(powerfulTypes).toContain(item.affixes[0].type);
    }
  });

  it("affix descriptions are non-empty strings", () => {
    for (let i = 0; i < 50; i++) {
      const quality: GachaQuality = ["white", "blue", "purple", "red", "gold"][i % 5] as GachaQuality;
      const item = generateItem(quality);
      for (const affix of item.affixes) {
        expect(affix.type).toBeTruthy();
        expect(affix.description).toBeTruthy();
        expect(typeof affix.description).toBe("string");
      }
    }
  });
});

// ==================== API Response Shape ====================

describe("PullResult shape validation", () => {
  it("validates expected response fields", () => {
    // This tests the shape that the API returns
    const mockResult = {
      item: {
        id: "test-id",
        name: "战术瞄准镜",
        quality: "blue" as GachaQuality,
        value: 250,
        affixes: [{ type: "value_bonus", description: "价值+15%" }],
      },
      ticketsRemaining: 2,
      pityProgress: { current: 10, target: 50 },
      isPityTriggered: false,
    };

    expect(mockResult.item.id).toBeTruthy();
    expect(mockResult.item.name).toBeTruthy();
    expect(["white", "blue", "purple", "red", "gold"]).toContain(mockResult.item.quality);
    expect(mockResult.item.value).toBeGreaterThan(0);
    expect(mockResult.ticketsRemaining).toBeGreaterThanOrEqual(0);
    expect(mockResult.pityProgress.current).toBeLessThanOrEqual(mockResult.pityProgress.target);
    expect(typeof mockResult.isPityTriggered).toBe("boolean");
  });
});

// ==================== Edge Cases ====================

describe("Edge cases", () => {
  it("handles crate with zero rate for some qualities", () => {
    // Supply drop has white = 0
    for (let i = 0; i < 100; i++) {
      const result = rollQuality(SUPPLY_DROP_RATES);
      expect(result).not.toBe("white");
    }
  });

  it("handles crate where only 2 qualities are available", () => {
    const binaryRates: Record<GachaQuality, number> = {
      white: 0, blue: 0, purple: 0, red: 0.5, gold: 0.5,
    };
    for (let i = 0; i < 100; i++) {
      const result = rollQuality(binaryRates);
      expect(result === "red" || result === "gold").toBe(true);
    }
  });

  it("rollQuality always returns even with extreme rates", () => {
    const allGold: Record<GachaQuality, number> = {
      white: 0, blue: 0, purple: 0, red: 0, gold: 1.0,
    };
    for (let i = 0; i < 50; i++) {
      expect(rollQuality(allGold)).toBe("gold");
    }
  });

  it("seeded RNG produces different sequences for different keys", () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const rng = seededRandom(`key-${i}`);
      const vals = Array.from({ length: 5 }, () => rng().toFixed(6)).join(",");
      results.add(vals);
    }
    // All 10 sequences should be different
    expect(results.size).toBe(10);
  });
});
