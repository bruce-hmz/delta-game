// 本地存储模块 - 用户数据和游戏进度

export interface LocalUser {
  userId: string;
  nickname: string;
  money: number;
  backpack: LocalItem[];
  safeBox: LocalItem[];
  redCount: number;
  maxProfit: number;
  totalGames: number;
  activeBuffs: ActiveBuff[];
  lastPlayTime: number;
}

export interface LocalItem {
  id: string;
  name: string;
  type: 'equipment' | 'consumable';
  quality: string;
  value: number;
  description: string;
}

export interface ActiveBuff {
  id: string;
  name: string;
  type: 'equipment' | 'consumable';
  effect: string;
  effectValue: number;
  remainingUses: number; // -1表示永久，>0表示剩余次数
  purchasedAt: number;
}

// 商店物品配置
export interface ShopItem {
  id: string;
  name: string;
  type: 'equipment' | 'consumable';
  price: number;
  effect: string;
  effectType: BuffEffectType;
  effectValue: number;
  duration: number; // -1永久，>0使用次数
  description: string;
}

export type BuffEffectType = 
  | 'death_rate_reduction'    // 死亡概率降低
  | 'red_drop_boost'          // 红装概率提升
  | 'death_protection'        // 死亡保护
  | 'combat_boost'            // 战斗加成
  | 'extract_boost';          // 撤离率提升

// 商店物品列表
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'night_vision',
    name: '🎯 夜视镜',
    type: 'equipment',
    price: 500,
    effect: '高危区死亡概率-10%',
    effectType: 'death_rate_reduction',
    effectValue: 0.1,
    duration: -1, // 永久
    description: '装备后可大幅降低高危区域的遭遇风险',
  },
  {
    id: 'lucky_charm',
    name: '🍀 幸运护符',
    type: 'consumable',
    price: 800,
    effect: '下一局红装概率+5%',
    effectType: 'red_drop_boost',
    effectValue: 0.05,
    duration: 1, // 使用1次
    description: '神秘的护符，据说能带来好运',
  },
  {
    id: 'medkit',
    name: '💉 急救包',
    type: 'consumable',
    price: 300,
    effect: '死亡时保留1件背包物品',
    effectType: 'death_protection',
    effectValue: 1,
    duration: 1,
    description: '关键时刻能救你一命',
  },
  {
    id: 'combat_armor',
    name: '🛡️ 战术护甲',
    type: 'equipment',
    price: 600,
    effect: '战斗胜率+15%',
    effectType: 'combat_boost',
    effectValue: 0.15,
    duration: -1,
    description: '精锐战术装备，提升生存能力',
  },
  {
    id: 'smoke_grenade',
    name: '💨 烟雾弹',
    type: 'consumable',
    price: 400,
    effect: '撤离成功率+20%',
    effectType: 'extract_boost',
    effectValue: 0.2,
    duration: 1,
    description: '紧急撤离时的绝佳道具',
  },
  {
    id: 'golden_ticket',
    name: '🎫 黄金通行证',
    type: 'consumable',
    price: 1500,
    effect: '本局必出红装（一次）',
    effectType: 'red_drop_boost',
    effectValue: 1, // 100%概率
    duration: 1,
    description: '持有此证，红装必出！',
  },
];

// 存储键名
const STORAGE_KEY = 'delta_ops_user';

// 生成唯一ID
function generateId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// 获取本地用户数据
export function getLocalUser(): LocalUser | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取本地存储失败:', error);
  }
  return null;
}

// 保存本地用户数据
export function saveLocalUser(user: LocalUser): void {
  if (typeof window === 'undefined') return;
  
  try {
    user.lastPlayTime = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('保存本地存储失败:', error);
  }
}

// 创建默认用户
export function createDefaultUser(nickname: string): LocalUser {
  return {
    userId: generateId(),
    nickname,
    money: 2000, // 初始资金2000
    backpack: [],
    safeBox: [],
    redCount: 0,
    maxProfit: 0,
    totalGames: 0,
    activeBuffs: [],
    lastPlayTime: Date.now(),
  };
}

// 初始化或获取用户
export function initOrGetUser(nickname?: string): LocalUser {
  let user = getLocalUser();
  
  if (!user && nickname) {
    user = createDefaultUser(nickname);
    saveLocalUser(user);
  }
  
  return user!;
}

// 购买商店物品
export function purchaseShopItem(user: LocalUser, itemId: string): { success: boolean; message: string; user: LocalUser } {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  
  if (!item) {
    return { success: false, message: '物品不存在', user };
  }
  
  if (user.money < item.price) {
    return { success: false, message: `余额不足！需要 ${item.price}，当前 ${user.money}`, user };
  }
  
  // 扣除金钱
  user.money -= item.price;
  
  // 添加到activeBuffs
  const buff: ActiveBuff = {
    id: generateId(),
    name: item.name,
    type: item.type,
    effect: item.effect,
    effectValue: item.effectValue,
    remainingUses: item.duration,
    purchasedAt: Date.now(),
  };
  
  user.activeBuffs.push(buff);
  
  // 保存
  saveLocalUser(user);
  
  return {
    success: true,
    message: `【购买成功】\n你购买了 ${item.name}\n效果：${item.effect}\n剩余资金：${user.money}`,
    user,
  };
}

// 使用消耗品（每次回合结束或特定事件时调用）
export function useConsumableBuff(user: LocalUser, buffId: string): LocalUser {
  const buffIndex = user.activeBuffs.findIndex(b => b.id === buffId);
  
  if (buffIndex === -1) return user;
  
  const buff = user.activeBuffs[buffIndex];
  
  // 如果是消耗品且有剩余次数
  if (buff.type === 'consumable' && buff.remainingUses > 0) {
    buff.remainingUses--;
    
    // 用完后移除
    if (buff.remainingUses <= 0) {
      user.activeBuffs.splice(buffIndex, 1);
    }
  }
  
  saveLocalUser(user);
  return user;
}

// 获取当前生效的buff效果总值
export function getActiveBuffEffects(user: LocalUser): {
  deathRateReduction: number;
  redDropBoost: number;
  deathProtection: number;
  combatBoost: number;
  extractBoost: number;
} {
  const effects = {
    deathRateReduction: 0,
    redDropBoost: 0,
    deathProtection: 0,
    combatBoost: 0,
    extractBoost: 0,
  };
  
  for (const buff of user.activeBuffs) {
    // 检查是否已用完
    if (buff.remainingUses === 0) continue;
    
    switch (buff.effect.includes('死亡概率') || buff.name.includes('夜视镜') ? 'death_rate_reduction' :
           buff.effect.includes('红装') || buff.effect.includes('必出红') ? 'red_drop_boost' :
           buff.effect.includes('保留') ? 'death_protection' :
           buff.effect.includes('战斗') ? 'combat_boost' :
           buff.effect.includes('撤离') ? 'extract_boost' : null) {
      case 'death_rate_reduction':
        effects.deathRateReduction += buff.effectValue;
        break;
      case 'red_drop_boost':
        effects.redDropBoost += buff.effectValue;
        break;
      case 'death_protection':
        effects.deathProtection += buff.effectValue;
        break;
      case 'combat_boost':
        effects.combatBoost += buff.effectValue;
        break;
      case 'extract_boost':
        effects.extractBoost += buff.effectValue;
        break;
    }
  }
  
  return effects;
}

// 更新用户资产
export function updateUserAssets(
  user: LocalUser,
  updates: {
    money?: number;
    backpack?: LocalItem[];
    safeBox?: LocalItem[];
    redCount?: number;
    maxProfit?: number;
    totalGames?: number;
  }
): LocalUser {
  if (updates.money !== undefined) user.money = updates.money;
  if (updates.backpack !== undefined) user.backpack = updates.backpack;
  if (updates.safeBox !== undefined) user.safeBox = updates.safeBox;
  if (updates.redCount !== undefined) user.redCount = updates.redCount;
  if (updates.maxProfit !== undefined) user.maxProfit = updates.maxProfit;
  if (updates.totalGames !== undefined) user.totalGames = updates.totalGames;
  
  saveLocalUser(user);
  return user;
}

// 重置游戏（保留用户ID和昵称，重置其他数据）
export function resetLocalGame(user: LocalUser): LocalUser {
  const newUser: LocalUser = {
    userId: user.userId,
    nickname: user.nickname,
    money: 2000,
    backpack: [],
    safeBox: [],
    redCount: 0,
    maxProfit: 0,
    totalGames: 0,
    activeBuffs: [],
    lastPlayTime: Date.now(),
  };
  
  saveLocalUser(newUser);
  return newUser;
}

// 检查是否有特定buff
export function hasBuff(user: LocalUser, effectType: string): boolean {
  return user.activeBuffs.some(buff => {
    if (buff.remainingUses === 0) return false;
    
    // 根据效果类型匹配
    if (effectType === 'red_drop_boost' && (buff.effect.includes('红装') || buff.effect.includes('必出红'))) {
      return true;
    }
    if (effectType === 'death_protection' && buff.effect.includes('保留')) {
      return true;
    }
    if (effectType === 'extract_boost' && buff.effect.includes('撤离')) {
      return true;
    }
    return false;
  });
}

// 消耗特定类型的buff
export function consumeBuff(user: LocalUser, effectType: string): LocalUser {
  const buffIndex = user.activeBuffs.findIndex(buff => {
    if (buff.remainingUses === 0) return false;
    
    if (effectType === 'red_drop_boost' && (buff.effect.includes('红装') || buff.effect.includes('必出红'))) {
      return true;
    }
    if (effectType === 'death_protection' && buff.effect.includes('保留')) {
      return true;
    }
    if (effectType === 'extract_boost' && buff.effect.includes('撤离')) {
      return true;
    }
    return false;
  });
  
  if (buffIndex !== -1) {
    const buff = user.activeBuffs[buffIndex];
    if (buff.type === 'consumable') {
      buff.remainingUses--;
      if (buff.remainingUses <= 0) {
        user.activeBuffs.splice(buffIndex, 1);
      }
    }
    saveLocalUser(user);
  }
  
  return user;
}
