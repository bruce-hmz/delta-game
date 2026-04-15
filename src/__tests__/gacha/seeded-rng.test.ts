import { describe, it, expect } from "vitest";
import { seededRandom } from "@/lib/game/gacha-constants";

describe("Seeded RNG", () => {
  it("produces deterministic output for same seed", () => {
    const rng1 = seededRandom("idem-key-001");
    const rng2 = seededRandom("idem-key-001");

    const values1 = Array.from({ length: 20 }, () => rng1());
    const values2 = Array.from({ length: 20 }, () => rng2());

    expect(values1).toEqual(values2);
  });

  it("produces different output for different seeds", () => {
    const rng1 = seededRandom("seed-a");
    const rng2 = seededRandom("seed-b");

    const values1 = Array.from({ length: 20 }, () => rng1());
    const values2 = Array.from({ length: 20 }, () => rng2());

    expect(values1).not.toEqual(values2);
  });

  it("produces values in [0, 1) range", () => {
    const rng = seededRandom("test");
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
