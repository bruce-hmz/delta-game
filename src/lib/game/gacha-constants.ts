// Gacha-specific constants
// Quality config reused from existing QUALITY_CONFIG in constants.ts

export type GachaQuality = "white" | "blue" | "purple" | "red" | "gold";

export const QUALITY_ORDER: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];

export const PITY_THRESHOLD = 50;
export const GUEST_DAILY_LIMIT = 3;
export const PLAYER_DAILY_LIMIT = 5;
export const PREMIUM_DAILY_LIMIT = Infinity;

export const GUEST_SESSION_EXPIRY_DAYS = 7;

// Item name pools per quality tier (reused from EQUIPMENT_NAMES)
export const ITEM_NAMES: Record<GachaQuality, string[]> = {
  white: ["基础弹药", "医疗包", "战术背心", "防弹插板", "简易绷带", "能量饮料"],
  blue: ["战术瞄准镜", "消音器", "扩容弹匣", "战术护膝", "快速弹夹", "增强护甲"],
  purple: ["高级战术模块", "纳米修复系统", "增强外骨骼", "智能瞄准辅助", "热成像瞄准器", "电磁护盾"],
  red: ["战术核心模块", "量子处理器", "等离子推进器", "能量护盾发生器", "神经链接装置", "时序加速器"],
  gold: ["远古神器", "星际核心", "永恒之钥", "创世模块", "神话引擎", "命运罗盘"],
};

// Value ranges per quality
export const VALUE_RANGES: Record<GachaQuality, [number, number]> = {
  white: [50, 150],
  blue: [150, 400],
  purple: [400, 1000],
  red: [1000, 3000],
  gold: [3000, 8000],
};

// Affix pools
export const AFFIX_POOL = [
  { type: "value_bonus", min: 5, max: 25, desc: (v: number) => `价值+${v}%` },
  { type: "drop_rate", min: 3, max: 10, desc: (v: number) => `开红概率+${v}%` },
  { type: "luck", min: 1, max: 5, desc: (v: number) => `幸运+${v}` },
];

export const POWERFUL_AFFIX_POOL = [
  { type: "guaranteed_red", value: 1, desc: () => "🎯 下次必出红" },
  { type: "value_double", value: 1, desc: () => "💰 下次价值翻倍" },
  { type: "extra_pull", value: 1, desc: () => "🎫 免费额外开箱" },
];

// Seed-based deterministic RNG for server-authoritative sync
export function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
}
