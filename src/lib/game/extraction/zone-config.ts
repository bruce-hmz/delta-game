import type { GachaQuality } from "@/lib/game/gacha-constants";
import type { ZoneConfig } from "./types";

export const ZONE_IDS = [
  "hawkeye_power",
  "zero_dam",
  "black_hawk",
  "aurora_lab",
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

export const ZONES: Record<string, ZoneConfig> = {
  hawkeye_power: {
    id: "hawkeye_power",
    name: "哈夫克发电站",
    difficulty: "low",
    nodeCountRange: [5, 8],
    dropRates: {
      white: 0.55,
      blue: 0.28,
      purple: 0.12,
      red: 0.04,
      gold: 0.01,
    } as Record<GachaQuality, number>,
    trapChance: 0.25,
    trapDamage: [5, 15],
    evacCount: 1,
  },
  zero_dam: {
    id: "zero_dam",
    name: "零号大坝",
    difficulty: "medium",
    nodeCountRange: [8, 12],
    dropRates: {
      white: 0.35,
      blue: 0.35,
      purple: 0.20,
      red: 0.08,
      gold: 0.02,
    } as Record<GachaQuality, number>,
    trapChance: 0.30,
    trapDamage: [10, 25],
    evacCount: 1,
  },
  black_hawk: {
    id: "black_hawk",
    name: "黑鹰坠落区",
    difficulty: "high",
    nodeCountRange: [12, 16],
    dropRates: {
      white: 0.20,
      blue: 0.25,
      purple: 0.30,
      red: 0.18,
      gold: 0.07,
    } as Record<GachaQuality, number>,
    trapChance: 0.35,
    trapDamage: [15, 35],
    evacCount: 2,
  },
  aurora_lab: {
    id: "aurora_lab",
    name: "极光实验室",
    difficulty: "extreme",
    nodeCountRange: [16, 20],
    dropRates: {
      white: 0.10,
      blue: 0.15,
      purple: 0.30,
      red: 0.30,
      gold: 0.15,
    } as Record<GachaQuality, number>,
    trapChance: 0.40,
    trapDamage: [20, 50],
    evacCount: 2,
  },
};
