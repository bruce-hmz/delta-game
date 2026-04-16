import { describe, it, expect } from "vitest";
import { rollQuality, generateItem } from "@/lib/game/gacha-service";
import { seededRandom, ITEM_NAMES, VALUE_RANGES } from "@/lib/game/gacha-constants";
import type { GachaQuality } from "@/lib/game/gacha-constants";

const MILITARY_RATES: Record<GachaQuality, number> = {
  white: 0.60, blue: 0.25, purple: 0.10, red: 0.04, gold: 0.01,
};

const SUPPLY_DROP_RATES: Record<GachaQuality, number> = {
  white: 0.00, blue: 0.40, purple: 0.30, red: 0.20, gold: 0.10,
};

const BLACK_MARKET_RATES: Record<GachaQuality, number> = {
  white: 0.00, blue: 0.00, purple: 0.30, red: 0.40, gold: 0.30,
};

describe("Drop rate calculation", () => {
  it("respects pity override", () => {
    const result = rollQuality(MILITARY_RATES, Math.random, true);
    expect(result).toBe("red");
  });

  it("always returns a valid quality", () => {
    const qualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];
    for (let i = 0; i < 100; i++) {
      const result = rollQuality(MILITARY_RATES);
      expect(qualities).toContain(result);
    }
  });

  it("produces distribution within statistical tolerance for military crate", () => {
    const N = 10_000;
    const counts: Record<GachaQuality, number> = { white: 0, blue: 0, purple: 0, red: 0, gold: 0 };

    for (let i = 0; i < N; i++) {
      counts[rollQuality(MILITARY_RATES)]++;
    }

    // Allow 30% relative tolerance at N=10000
    const tolerance = (rate: number) => rate * 0.30;

    expect(counts.white / N).toBeCloseTo(MILITARY_RATES.white, 1);
    expect(counts.blue / N).toBeCloseTo(MILITARY_RATES.blue, 1);
    expect(counts.purple / N).toBeCloseTo(MILITARY_RATES.purple, 1);
    // Red and gold have smaller sample sizes, wider tolerance
    expect(Math.abs(counts.red / N - MILITARY_RATES.red)).toBeLessThan(tolerance(MILITARY_RATES.red) + 0.02);
    expect(Math.abs(counts.gold / N - MILITARY_RATES.gold)).toBeLessThan(tolerance(MILITARY_RATES.gold) + 0.01);
  });

  it("never produces white/blue from black market crate", () => {
    for (let i = 0; i < 100; i++) {
      const result = rollQuality(BLACK_MARKET_RATES);
      expect(result).not.toBe("white");
      expect(result).not.toBe("blue");
    }
  });

  it("produces distribution for supply drop crate", () => {
    const N = 10_000;
    const counts: Record<GachaQuality, number> = { white: 0, blue: 0, purple: 0, red: 0, gold: 0 };

    for (let i = 0; i < N; i++) {
      counts[rollQuality(SUPPLY_DROP_RATES)]++;
    }

    expect(counts.white).toBe(0);
    expect(counts.blue / N).toBeCloseTo(SUPPLY_DROP_RATES.blue, 1);
    expect(counts.red / N).toBeCloseTo(SUPPLY_DROP_RATES.red, 1);
  });

  it("is deterministic with seeded RNG", () => {
    const rng1 = seededRandom("test-key-123");
    const rng2 = seededRandom("test-key-123");

    const results1 = Array.from({ length: 10 }, () => rollQuality(MILITARY_RATES, rng1));
    const results2 = Array.from({ length: 10 }, () => rollQuality(MILITARY_RATES, rng2));

    expect(results1).toEqual(results2);
  });

  it("produces different results with different seeds", () => {
    const rng1 = seededRandom("seed-a");
    const rng2 = seededRandom("seed-b");

    const results1 = Array.from({ length: 10 }, () => rollQuality(MILITARY_RATES, rng1));
    const results2 = Array.from({ length: 10 }, () => rollQuality(MILITARY_RATES, rng2));

    expect(results1).not.toEqual(results2);
  });
});

describe("Item generation", () => {
  it("generates items from the correct name pool", () => {
    for (let i = 0; i < 50; i++) {
      const item = generateItem("red");
      expect(ITEM_NAMES.red).toContain(item.name);
    }
  });

  it("generates values within the correct range", () => {
    for (let i = 0; i < 50; i++) {
      const item = generateItem("gold");
      const [min, max] = VALUE_RANGES.gold;
      expect(item.value).toBeGreaterThanOrEqual(min);
      expect(item.value).toBeLessThanOrEqual(max);
    }
  });

  it("gives white items 1 affix", () => {
    for (let i = 0; i < 20; i++) {
      const item = generateItem("white");
      expect(item.affixes.length).toBe(1);
    }
  });

  it("gives gold items 4 affixes with first being powerful", () => {
    for (let i = 0; i < 20; i++) {
      const item = generateItem("gold");
      expect(item.affixes.length).toBe(4);
      // First affix should be from powerful pool
      const powerfulTypes = ["guaranteed_red", "value_double", "extra_pull"];
      expect(powerfulTypes).toContain(item.affixes[0].type);
    }
  });
});
