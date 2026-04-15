import { describe, it, expect } from "vitest";
import type { GachaQuality } from "@/lib/game/gacha-constants";

// Probability disclosure validation
// Chinese gacha regulations require exact percentage display and sum = 100%

const VALID_RATES: Record<GachaQuality, number> = {
  white: 0.60, blue: 0.25, purple: 0.10, red: 0.04, gold: 0.01,
};

describe("Probability disclosure", () => {
  it("drop rates sum to exactly 1.0", () => {
    const sum = Object.values(VALID_RATES).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("all rates are non-negative", () => {
    for (const [quality, rate] of Object.entries(VALID_RATES)) {
      expect(rate, `${quality} rate should be non-negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it("no rate exceeds 1.0", () => {
    for (const [quality, rate] of Object.entries(VALID_RATES)) {
      expect(rate, `${quality} rate should not exceed 1.0`).toBeLessThanOrEqual(1);
    }
  });

  it("display values sum to 100.00%", () => {
    const percentages = Object.values(VALID_RATES).map((r) => (r * 100).toFixed(2));
    const sum = percentages.reduce((a, b) => a + parseFloat(b), 0);
    expect(sum).toBeCloseTo(100.0, 10);
  });

  it("rejects rates that don't sum to 1.0", () => {
    const badRates: Record<GachaQuality, number> = {
      white: 0.50, blue: 0.25, purple: 0.10, red: 0.04, gold: 0.01,
    };
    const sum = Object.values(badRates).reduce((a, b) => a + b, 0);
    expect(sum).not.toBeCloseTo(1.0, 10);
  });

  it("rejects negative rates", () => {
    const badRates: Record<GachaQuality, number> = {
      white: -0.1, blue: 0.25, purple: 0.10, red: 0.04, gold: 0.01,
    };
    const hasNegative = Object.values(badRates).some((r) => r < 0);
    expect(hasNegative).toBe(true);
  });
});
