// Monetization mechanics for the gacha extraction game
// - Extraction tickets (free tier: 5/day, premium: unlimited)
// - Gacha boosters (pay to increase drop rates)
// - Battle pass progression
// - Ad revives
// - Cosmetic effects

import type { Quality } from '../types';

// ==================== Types ====================

export interface TicketState {
  freeRunsToday: number;
  maxFreeRuns: number;
  lastResetDate: string;
  premium: boolean;
}

export interface BoosterState {
  active: boolean;
  qualityBoost: Partial<Record<Quality, number>>; // e.g., { red: 0.05, gold: 0.02 }
  durationMinutes: number;
  expiresAt: number | null; // timestamp
}

export interface BattlePassTier {
  level: number;
  name: string;
  requiredXP: number;
  reward: {
    type: 'cosmetic' | 'booster' | 'ticket';
    name: string;
    description: string;
  };
}

export interface CosmeticEffect {
  id: string;
  name: string;
  type: 'particle_color' | 'reveal_animation' | 'sound_pack' | 'card_frame';
  value: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number; // in coins
  description: string;
}

// ==================== Ticket System ====================

const FREE_RUN_LIMIT = 5;
const STORAGE_KEY = 'delta_game_tickets';

export class TicketSystem {
  private state: TicketState;

  constructor() {
    this.state = this.loadState();
    this.checkDailyReset();
  }

  private loadState(): TicketState {
    if (typeof window === 'undefined') {
      return { freeRunsToday: 0, maxFreeRuns: FREE_RUN_LIMIT, lastResetDate: '', premium: false };
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return { freeRunsToday: 0, maxFreeRuns: FREE_RUN_LIMIT, lastResetDate: this.getTodayStr(), premium: false };
  }

  private saveState() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  private checkDailyReset() {
    const today = this.getTodayStr();
    if (this.state.lastResetDate !== today) {
      this.state.freeRunsToday = 0;
      this.state.lastResetDate = today;
      this.saveState();
    }
  }

  canRun(): boolean {
    this.checkDailyReset();
    return this.state.premium || this.state.freeRunsToday < this.state.maxFreeRuns;
  }

  consumeTicket(): boolean {
    this.checkDailyReset();
    if (!this.canRun()) return false;
    if (!this.state.premium) {
      this.state.freeRunsToday++;
      this.saveState();
    }
    return true;
  }

  getRemainingRuns(): number {
    this.checkDailyReset();
    return this.state.premium ? Infinity : this.state.maxFreeRuns - this.state.freeRunsToday;
  }

  setPremium(premium: boolean) {
    this.state.premium = premium;
    this.saveState();
  }

  getState(): TicketState {
    return { ...this.state };
  }
}

// ==================== Booster System ====================

const BOOSTER_STORAGE_KEY = 'delta_game_boosters';

export class BoosterSystem {
  private boosters: BoosterState[] = [];

  constructor() {
    this.loadBoosters();
  }

  private loadBoosters() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(BOOSTER_STORAGE_KEY);
      if (stored) {
        this.boosters = JSON.parse(stored);
        // Remove expired boosters
        const now = Date.now();
        this.boosters = this.boosters.filter(b => !b.expiresAt || b.expiresAt > now);
        this.saveBoosters();
      }
    } catch {}
  }

  private saveBoosters() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BOOSTER_STORAGE_KEY, JSON.stringify(this.boosters));
  }

  activateBooster(qualityBoost: Partial<Record<Quality, number>>, durationMinutes: number): BoosterState {
    const booster: BoosterState = {
      active: true,
      qualityBoost,
      durationMinutes,
      expiresAt: Date.now() + durationMinutes * 60 * 1000,
    };
    this.boosters.push(booster);
    this.saveBoosters();
    return booster;
  }

  getActiveBoosters(): BoosterState[] {
    const now = Date.now();
    this.boosters = this.boosters.filter(b => !b.expiresAt || b.expiresAt > now);
    this.saveBoosters();
    return this.boosters.filter(b => b.active);
  }

  getDropRateBonus(quality: Quality): number {
    return this.getActiveBoosters().reduce((total, b) => {
      return total + (b.qualityBoost[quality] || 0);
    }, 0);
  }
}

// ==================== Battle Pass ====================

export const BATTLE_PASS_TIERS: BattlePassTier[] = [
  { level: 1, name: '新兵', requiredXP: 0, reward: { type: 'ticket', name: '额外门票 x1', description: '获得1次额外行动机会' } },
  { level: 2, name: '列兵', requiredXP: 100, reward: { type: 'cosmetic', name: '蓝色粒子', description: '蓝色品质掉落粒子效果' } },
  { level: 3, name: '下士', requiredXP: 300, reward: { type: 'booster', name: '幸运增幅 x1', description: '红装概率+3% 持续30分钟' } },
  { level: 4, name: '中士', requiredXP: 600, reward: { type: 'cosmetic', name: '紫色光环', description: '紫色品质掉落光环效果' } },
  { level: 5, name: '上士', requiredXP: 1000, reward: { type: 'ticket', name: '额外门票 x3', description: '获得3次额外行动机会' } },
  { level: 6, name: '少尉', requiredXP: 1500, reward: { type: 'booster', name: '黄金增幅 x1', description: '金装概率+2% 持续30分钟' } },
  { level: 7, name: '中尉', requiredXP: 2200, reward: { type: 'cosmetic', name: '烈焰卡框', description: '史诗掉落专属卡片边框' } },
  { level: 8, name: '上尉', requiredXP: 3000, reward: { type: 'cosmetic', name: '帝王音效', description: '传说掉落专属音效包' } },
  { level: 9, name: '少校', requiredXP: 4000, reward: { type: 'booster', name: '超级增幅 x1', description: '红+3% 金+2% 持续1小时' } },
  { level: 10, name: '指挥官', requiredXP: 5500, reward: { type: 'cosmetic', name: '指挥官主题', description: '完整UI主题更换' } },
];

const BATTLE_PASS_STORAGE_KEY = 'delta_game_battlepass';

export class BattlePassSystem {
  private xp = 0;
  private claimedTiers: Set<number> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(BATTLE_PASS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.xp = data.xp || 0;
        this.claimedTiers = new Set(data.claimedTiers || []);
      }
    } catch {}
  }

  private save() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BATTLE_PASS_STORAGE_KEY, JSON.stringify({
      xp: this.xp,
      claimedTiers: [...this.claimedTiers],
    }));
  }

  addXP(amount: number) {
    this.xp += amount;
    this.save();
  }

  getXP(): number { return this.xp; }

  getCurrentTier(): number {
    let tier = 0;
    for (const t of BATTLE_PASS_TIERS) {
      if (this.xp >= t.requiredXP) tier = t.level;
      else break;
    }
    return tier;
  }

  getNextTier(): BattlePassTier | null {
    const current = this.getCurrentTier();
    const next = BATTLE_PASS_TIERS.find(t => t.level === current + 1);
    return next || null;
  }

  canClaim(level: number): boolean {
    const tier = BATTLE_PASS_TIERS.find(t => t.level === level);
    if (!tier) return false;
    return this.xp >= tier.requiredXP && !this.claimedTiers.has(level);
  }

  claim(level: number): BattlePassTier['reward'] | null {
    if (!this.canClaim(level)) return null;
    this.claimedTiers.add(level);
    this.save();
    return BATTLE_PASS_TIERS.find(t => t.level === level)?.reward || null;
  }

  getClaimedTiers(): number[] { return [...this.claimedTiers]; }

  getProgress(): { current: number; required: number; percentage: number } {
    const next = this.getNextTier();
    if (!next) return { current: this.xp, required: this.xp, percentage: 100 };
    const prev = BATTLE_PASS_TIERS.find(t => t.level === next.level - 1);
    const prevXP = prev?.requiredXP || 0;
    const inTier = this.xp - prevXP;
    const tierTotal = next.requiredXP - prevXP;
    return { current: inTier, required: tierTotal, percentage: Math.min(100, (inTier / tierTotal) * 100) };
  }
}

// ==================== Cosmetic Shop ====================

export const COSMETIC_ITEMS: CosmeticEffect[] = [
  { id: 'particle_blue', name: '深海蓝粒子', type: 'particle_color', value: '#0066ff', rarity: 'common', price: 500, description: '蓝色品质掉落粒子效果' },
  { id: 'particle_red', name: '烈焰红粒子', type: 'particle_color', value: '#ff3300', rarity: 'rare', price: 1500, description: '红色品质掉落粒子效果' },
  { id: 'particle_gold', name: '黄金粒子', type: 'particle_color', value: '#ffcc00', rarity: 'epic', price: 3000, description: '金色品质掉落粒子效果' },
  { id: 'particle_rainbow', name: '彩虹粒子', type: 'particle_color', value: 'rainbow', rarity: 'legendary', price: 8000, description: '彩虹品质掉落粒子效果' },
  { id: 'reveal_spin', name: '旋转揭示', type: 'reveal_animation', value: 'spin', rarity: 'rare', price: 2000, description: '物品揭示时旋转动画' },
  { id: 'reveal_explode', name: '爆炸揭示', type: 'reveal_animation', value: 'explode', rarity: 'epic', price: 4000, description: '物品揭示时爆炸动画' },
  { id: 'sound_8bit', name: '8-bit 音效', type: 'sound_pack', value: '8bit', rarity: 'rare', price: 1500, description: '复古像素风音效包' },
  { id: 'sound_orchestra', name: '交响乐音效', type: 'sound_pack', value: 'orchestra', rarity: 'legendary', price: 6000, description: '交响乐品质音效包' },
  { id: 'frame_gold', name: '黄金卡框', type: 'card_frame', value: 'gold', rarity: 'epic', price: 3500, description: '黄金色物品卡片边框' },
  { id: 'frame_diamond', name: '钻石卡框', type: 'card_frame', value: 'diamond', rarity: 'legendary', price: 10000, description: '钻石色物品卡片边框' },
];

const OWNED_COSMETICS_KEY = 'delta_game_cosmetics';

export function getOwnedCosmetics(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(OWNED_COSMETICS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function purchaseCosmetic(id: string): boolean {
  const item = COSMETIC_ITEMS.find(c => c.id === id);
  if (!item) return false;
  const owned = getOwnedCosmetics();
  if (owned.includes(id)) return false;
  owned.push(id);
  localStorage.setItem(OWNED_COSMETICS_KEY, JSON.stringify(owned));
  return true;
}

// ==================== Ad Revive ====================

export interface AdReviveState {
  usedThisRun: boolean;
  maxPerRun: number;
}

const AD_REVIVE_KEY = 'delta_game_ad_revive';

export function canAdRevive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const state = JSON.parse(localStorage.getItem(AD_REVIVE_KEY) || '{"used":false,"runId":""}');
    // In production, check current runId
    return !state.used;
  } catch { return true; }
}

export function consumeAdRevive() {
  localStorage.setItem(AD_REVIVE_KEY, JSON.stringify({ used: true, runId: Date.now() }));
}

export function resetAdRevive() {
  localStorage.setItem(AD_REVIVE_KEY, JSON.stringify({ used: false, runId: '' }));
}

// ==================== Singletons ====================

export const ticketSystem = new TicketSystem();
export const boosterSystem = new BoosterSystem();
export const battlePass = new BattlePassSystem();
