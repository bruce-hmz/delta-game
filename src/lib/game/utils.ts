// 游戏核心工具函数

import {
  Quality,
  ZoneType,
  Equipment,
  Affix,
  AffixType,
  InventoryItem,
  PlayerState,
  CombatResult,
  ExploreResult,
  ExtractResult,
  GameEvent,
} from './types';

import {
  DROP_RATES,
  QUALITY_CONFIG,
  EQUIPMENT_NAMES,
  AFFIX_CONFIG,
  POWERFUL_AFFIX_CONFIG,
  BASE_VALUE_RANGES,
  COOL_DESCRIPTIONS,
  RED_DROP_ANNOUNCEMENTS,
  EMOTIONAL_MANIPULATION,
  EXTRACT_PSYCHOLOGY,
  SHARE_TEMPLATES,
  LEADERBOARD_TIPS,
  COMBAT_RATES,
  ZONE_DEATH_RATES,
  BASE_COMBAT_WIN_RATE,
  BASE_EXTRACT_RATE,
  PITY_SYSTEM,
  BAG_SIZE,
  SAFE_BOX_SIZE,
  INITIAL_MONEY,
} from './constants';

// 品质符号
const QUALITY_SYMBOLS: Record<string, string> = {
  white: '',
  blue: '🔷',
  purple: '🟣',
  red: '🔥',
  gold: '💰',
};

// 生成唯一ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// 随机整数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 随机浮点数
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 随机选择
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 根据概率选择品质
function rollQuality(zone: ZoneType, bonusRate: number = 0): Quality {
  const rates = { ...DROP_RATES[zone] };
  
  // 应用额外开红概率
  if (bonusRate > 0) {
    // 从低品质转移概率到高品质
    const transferRate = Math.min(bonusRate, rates.white || rates.blue || 0);
    rates.red = (rates.red || 0) + transferRate * 0.7;
    rates.gold = (rates.gold || 0) + transferRate * 0.3;
  }
  
  const roll = Math.random();
  let cumulative = 0;
  
  const qualityOrder: Quality[] = ['gold', 'red', 'purple', 'blue', 'white'];
  
  for (const quality of qualityOrder) {
    cumulative += rates[quality];
    if (roll < cumulative) {
      return quality;
    }
  }
  
  return 'white';
}

// 生成普通词条
function generateNormalAffix(): Affix {
  const config = randomChoice(AFFIX_CONFIG);
  const value = randomInt(config.min, config.max);
  
  return {
    type: config.type as AffixType,
    value,
    description: config.getDescription(value),
  };
}

// 生成强力词条（红/金装备专用）
function generatePowerfulAffix(): Affix {
  const config = randomChoice(POWERFUL_AFFIX_CONFIG);
  
  return {
    type: config.type as AffixType,
    value: config.value,
    description: config.getDescription(),
  };
}

// 生成装备
export function generateEquipment(quality: Quality, zone: ZoneType): Equipment {
  const config = QUALITY_CONFIG[quality];
  const names = EQUIPMENT_NAMES[quality];
  const valueRange = BASE_VALUE_RANGES[quality];
  
  const name = randomChoice(names);
  const baseValue = randomInt(valueRange[0], valueRange[1]);
  
  // 生成词条
  const affixes: Affix[] = [];
  
  // 红/金装备必出至少1条强力词条
  if (quality === 'red' || quality === 'gold') {
    affixes.push(generatePowerfulAffix());
    // 剩余词条用普通词条填充
    for (let i = 1; i < config.affixCount; i++) {
      affixes.push(generateNormalAffix());
    }
  } else {
    // 普通品质只用普通词条
    for (let i = 0; i < config.affixCount; i++) {
      affixes.push(generateNormalAffix());
    }
  }
  
  // 计算总价值
  const valueBonus = affixes
    .filter(a => a.type === 'value_bonus')
    .reduce((sum, a) => sum + a.value, 0);
  
  const totalValue = Math.round(baseValue * config.valueMultiplier * (1 + valueBonus / 100));
  
  // 生成描述
  const coolDesc = randomChoice(COOL_DESCRIPTIONS[quality]);
  
  return {
    id: generateId(),
    name: `${config.emoji} ${name}`,
    quality,
    affixes,
    baseValue,
    totalValue,
    description: coolDesc,
  };
}

// 判断是否开红（红或金）
function isRedDrop(quality: Quality): boolean {
  return quality === 'red' || quality === 'gold';
}

// 掉落装备
export function dropEquipment(zone: ZoneType, player: PlayerState): { equipment: Equipment; isRed: boolean } {
  // 计算实际开红概率
  let bonusRate = player.bonusDropRate;
  
  // 保底机制：连续失败
  if (player.failStreak >= PITY_SYSTEM.failStreakBonus) {
    bonusRate += PITY_SYSTEM.failBonusRate;
  }
  
  // 保底机制：连续未开红
  if (player.noDropStreak >= PITY_SYSTEM.noDropStreakPity) {
    // 必出红
    const quality = Math.random() < 0.3 ? 'gold' : 'red';
    return {
      equipment: generateEquipment(quality, zone),
      isRed: true,
    };
  }
  
  const quality = rollQuality(zone, bonusRate);
  const equipment = generateEquipment(quality, zone);
  
  return {
    equipment,
    isRed: isRedDrop(quality),
  };
}

// 战斗系统
export function combat(player: PlayerState): CombatResult {
  // 计算战斗胜率
  let winRate = BASE_COMBAT_WIN_RATE;
  
  // 初始化装备槽（兼容旧数据）
  const equipmentSlots = player.equipmentSlots || [];
  const safeBox = player.safeBox || [];
  
  // 装备加成（包括装备槽、背包、保险箱）
  const allItems = [...equipmentSlots, ...player.inventory, ...safeBox];
  for (const item of allItems) {
    if (item.type === 'equipment') {
      const equip = item.item as Equipment;
      for (const affix of equip.affixes) {
        if (affix.type === 'combat_rate') {
          winRate += affix.value / 100;
        }
      }
    }
  }
  
  winRate += player.combatWinRateBonus;
  winRate = Math.min(winRate, 0.95); // 最高95%
  
  const success = Math.random() < winRate;
  
  if (success) {
    // 胜利，获得额外奖励
    const quality = Math.random() < 0.3 ? 'purple' : 'blue';
    const reward = generateEquipment(quality, 'dangerous');
    
    return {
      success: true,
      reward,
      message: `【遭遇敌人】\n你与敌方巡逻队交火！\n🎯 战术胜利！成功击退敌人。\n缴获战利品：${reward.name}`,
    };
  } else {
    return {
      success: false,
      message: '【遭遇伏击】\n⚠️ 你遭遇敌方精锐部队！\n💀 战斗失败...行动终止。',
    };
  }
}

// 区域战术描述
const ZONE_TACTICAL_NAMES = {
  normal: '废弃居民区',
  dangerous: '军事仓库',
  boss: '黑区实验室',
};

const ZONE_ACTIONS = {
  normal: ['搜索废弃建筑', '检查地下掩体', '探索封锁区域', '潜入民用设施'],
  dangerous: ['突破军事防线', '搜索武器库', '潜入指挥中心', '破解安全系统'],
  boss: ['深入核心区域', '突破生物实验室', '搜索机密档案', '潜入黑区深处'],
};

const SEARCH_DESCRIPTIONS = [
  '你撬开了一个军用补给箱',
  '你发现了一处隐蔽的储藏点',
  '你在废墟中找到了被封存的物资',
  '你破解了一个加密储物柜',
  '你搜索了敌人的遗留物资',
];

// 探索区域
export function exploreZone(
  zone: ZoneType,
  player: PlayerState
): ExploreResult {
  const result: ExploreResult = {
    success: true,
    isRedDrop: false,
    message: '',
  };
  
  // ========== 第一步：区域死亡风险检查 ==========
  // 每个区域有独立的死亡概率，与战斗无关
  let deathRate = ZONE_DEATH_RATES[zone];
  
  // 计算装备的死亡保护效果
  const deathProtection = calculateDeathProtection(player);
  deathRate = deathRate * (1 - deathProtection / 100);
  
  // 执行死亡检定
  if (Math.random() < deathRate) {
    result.success = false;
    
    // 生成死亡原因
    const deathReasons = {
      normal: [
        '你在搜索时触发了残留的爆炸物！',
        '废弃建筑的承重结构突然坍塌！',
        '你被潜伏的感染者袭击！',
      ],
      dangerous: [
        '你触发了隐藏的地雷阵！',
        '敌方狙击手锁定了你的位置！',
        '毒气泄漏！你来不及反应！',
      ],
      boss: [
        '黑区安保系统启动，自动炮台锁定了你！',
        '你踩中了高压电陷阱！',
        '未知生物从阴影中扑出！',
        '实验室核心区域的自毁程序启动！',
      ],
    };
    
    const deathReason = randomChoice(deathReasons[zone]);
    result.message = `【潜入${ZONE_TACTICAL_NAMES[zone]}】\n💀 ${deathReason}\n\n行动失败。`;
    
    // 检查是否有死亡保护装备
    if (deathProtection > 0) {
      result.message += `\n（装备降低了 ${deathProtection.toFixed(1)}% 死亡概率）`;
    }
    
    return result;
  }
  
  // ========== 第二步：战斗遭遇检查 ==========
  const combatRate = COMBAT_RATES[zone];
  const encounterCombat = Math.random() < combatRate;
  
  if (encounterCombat) {
    const combatResult = combat(player);
    result.combat = combatResult;
    
    if (!combatResult.success) {
      result.success = false;
      result.message = combatResult.message;
      return result;
    }
    
    result.message = combatResult.message;
    
    // 战斗胜利奖励
    if (combatResult.reward) {
      result.loot = combatResult.reward;
      if (isRedDrop(combatResult.reward.quality)) {
        result.isRedDrop = true;
        // 战斗胜利开红爆发文案
        const announcement = generateRedDropAnnouncement(
          player.name,
          combatResult.reward.quality as 'red' | 'gold',
          '激战中',
          combatResult.reward.totalValue
        );
        result.redDropAnnouncement = announcement;
        result.broadcast = announcement.broadcast;
        result.shareText = generateShareText(
          combatResult.reward.quality === 'gold' ? 'goldDrop' : 'redDrop',
          combatResult.reward.totalValue
        );
      }
    }
    
    return result;
  }
  
  // 正常掉落
  const { equipment, isRed } = dropEquipment(zone, player);
  result.loot = equipment;
  result.isRedDrop = isRed;
  
  // 生成战术风格消息
  const action = randomChoice(ZONE_ACTIONS[zone]);
  const searchDesc = randomChoice(SEARCH_DESCRIPTIONS);
  
  result.message = `【潜入${ZONE_TACTICAL_NAMES[zone]}】\n📍 ${action}...\n${searchDesc}。`;
  
  // 生成词条描述
  if (equipment.affixes.length > 0) {
    result.message += '\n\n【战利品详情】';
    equipment.affixes.forEach(affix => {
      result.message += `\n  • ${affix.description}`;
      // 强力词条额外描述
      const powerfulDesc = getPowerfulAffixDescription(affix.type);
      if (powerfulDesc) {
        result.message += `\n    💫 ${powerfulDesc}`;
      }
    });
    result.message += `\n\n估值：${equipment.totalValue.toLocaleString()}`;
  }
  
  // 开红爆发文案
  if (isRed) {
    const quality = equipment.quality as 'red' | 'gold';
    const announcement = generateRedDropAnnouncement(
      player.name,
      quality,
      ZONE_TACTICAL_NAMES[zone],
      equipment.totalValue
    );
    result.redDropAnnouncement = announcement;
    result.broadcast = announcement.broadcast;
    result.shareText = generateShareText(
      quality === 'gold' ? 'goldDrop' : 'redDrop',
      equipment.totalValue
    );
  }
  
  return result;
}

// 撤离系统
export function extract(player: PlayerState): ExtractResult {
  // 计算撤离率
  let extractRate = BASE_EXTRACT_RATE;
  
  // 初始化装备槽（兼容旧数据）
  const equipmentSlots = player.equipmentSlots || [];
  const safeBox = player.safeBox || [];
  
  // 装备加成（包括装备槽、背包、保险箱）
  const allItems = [...equipmentSlots, ...player.inventory, ...safeBox];
  for (const item of allItems) {
    if (item.type === 'equipment') {
      const equip = item.item as Equipment;
      for (const affix of equip.affixes) {
        if (affix.type === 'extract_rate') {
          extractRate += affix.value / 100;
        }
      }
    }
  }
  
  extractRate += player.extractRateBonus;
  extractRate = Math.min(extractRate, 0.98); // 最高98%
  
  const success = Math.random() < extractRate;
  
  if (success) {
    // 计算总价值（装备槽 + 背包）
    const totalValue = calculateAllItemsValue(player);
    
    return {
      success: true,
      totalValue,
      message: `【撤离点已确认】\n🚁 接应直升机抵达...\n✅ 撤离成功！\n\n你成功带出了价值 ${totalValue.toLocaleString()} 的物资！\n本次行动圆满结束。`,
    };
  } else {
    return {
      success: false,
      totalValue: 0,
      message: '【撤离失败】\n⚠️ 撤离点遭遇伏击！\n💀 敌方火力压制...你被迫丢弃背包物资...\n\n行动失败。背包战利品丢失。\n装备槽和保险箱物品保留。',
    };
  }
}

// 计算背包价值
export function calculateInventoryValue(player: PlayerState): number {
  return player.inventory.reduce((sum, item) => {
    if (item.type === 'equipment') {
      return sum + (item.item as Equipment).totalValue;
    } else {
      return sum + (item.item as { value: number }).value;
    }
  }, 0);
}

// 计算所有物品价值（装备槽 + 背包）
export function calculateAllItemsValue(player: PlayerState): number {
  // 初始化装备槽（兼容旧数据）
  const equipmentSlots = player.equipmentSlots || [];
  const inventory = player.inventory || [];
  
  let totalValue = 0;
  
  // 装备槽价值
  for (const item of equipmentSlots) {
    if (item.type === 'equipment') {
      totalValue += (item.item as Equipment).totalValue;
    } else {
      totalValue += (item.item as { value: number }).value;
    }
  }
  
  // 背包价值
  for (const item of inventory) {
    if (item.type === 'equipment') {
      totalValue += (item.item as Equipment).totalValue;
    } else {
      totalValue += (item.item as { value: number }).value;
    }
  }
  
  return totalValue;
}

// 计算总资产
export function calculateTotalWealth(player: PlayerState): number {
  return player.money + calculateInventoryValue(player);
}

// 创建新玩家
export function createNewPlayer(name: string): PlayerState {
  return {
    id: generateId(),
    name,
    money: INITIAL_MONEY,
    equipmentSlots: [],
    inventory: [],
    safeBox: [],
    currentRound: 1,
    totalExtractValue: 0,
    failStreak: 0,
    winStreak: 0,
    noDropStreak: 0,
    bonusDropRate: 0,
    combatWinRateBonus: 0,
    extractRateBonus: 0,
    isAlive: true,
  };
}

// 添加物品到背包
export function addToInventory(player: PlayerState, item: InventoryItem): boolean {
  // 初始化装备槽（兼容旧数据）
  if (!player.equipmentSlots) {
    player.equipmentSlots = [];
  }
  
  // 优先尝试放入装备槽
  if (item.type === 'equipment' && player.equipmentSlots.length < 10) {
    player.equipmentSlots.push(item);
    return true;
  }
  
  // 计算实际背包容量
  let bagSize = BAG_SIZE;
  
  // 检查装备加成
  const allItems = [...player.equipmentSlots, ...player.safeBox || []];
  for (const invItem of allItems) {
    if (invItem.type === 'equipment') {
      const equip = invItem.item as Equipment;
      for (const affix of equip.affixes) {
        if (affix.type === 'bag_size') {
          bagSize += affix.value;
        }
      }
    }
  }
  
  if (player.inventory.length >= bagSize) {
    return false;
  }
  
  player.inventory.push(item);
  return true;
}

// 智能添加物品（优先空槽，不自动替换）
export function smartAddItem(
  player: PlayerState, 
  item: InventoryItem
): { 
  success: boolean; 
  location: 'equipment' | 'backpack' | 'safebox' | 'full'; 
  message: string;
  needChoice?: boolean;
  choices?: { id: string; label: string; description: string }[];
} {
  // 初始化装备槽
  if (!player.equipmentSlots) {
    player.equipmentSlots = [];
  }
  
  // 初始化保险箱
  if (!player.safeBox) {
    player.safeBox = [];
  }
  
  // 1. 优先尝试放入装备槽空位（仅装备类）
  if (item.type === 'equipment') {
    if (player.equipmentSlots.length < 10) {
      // 有空槽，直接放入
      player.equipmentSlots.push(item);
      return { 
        success: true, 
        location: 'equipment', 
        message: '装备已自动装备' 
      };
    }
    // 装备槽已满，继续检查背包
  }
  
  // 2. 尝试放入背包空位
  if (player.inventory.length < BAG_SIZE) {
    player.inventory.push(item);
    return { 
      success: true, 
      location: 'backpack', 
      message: '物品已放入背包' 
    };
  }
  
  // 3. 尝试放入保险箱空位
  if (player.safeBox.length < SAFE_BOX_SIZE) {
    player.safeBox.push(item);
    return { 
      success: true, 
      location: 'safebox', 
      message: '装备槽和背包已满，物品已放入保险箱' 
    };
  }
  
  // 4. 全部满了，返回需要玩家选择
  const choices: { id: string; label: string; description: string }[] = [];
  
  // 装备类可以替换装备槽
  if (item.type === 'equipment') {
    choices.push({ 
      id: 'equip_replace', 
      label: '替换装备槽', 
      description: `选择一个装备槽位替换 (${player.equipmentSlots.length}/10)` 
    });
  }
  
  // 可以替换背包
  choices.push({ 
    id: 'backpack_replace', 
    label: '替换背包', 
    description: `选择一个背包位置替换 (${player.inventory.length}/${BAG_SIZE})` 
  });
  
  // 可以放入保险箱（如果有空位，但前面已经检查过没有空位了，所以这里也可以替换）
  choices.push({ 
    id: 'safebox_replace', 
    label: '放入保险箱', 
    description: `替换保险箱位置 (${player.safeBox.length}/${SAFE_BOX_SIZE})` 
  });
  
  // 可以丢弃
  choices.push({ 
    id: 'discard', 
    label: '丢弃', 
    description: '放弃这件装备' 
  });
  
  return { 
    success: false, 
    location: 'full', 
    message: '装备槽、背包和保险箱都已满',
    needChoice: true,
    choices,
  };
}

// 检查物品存放选项
export function checkItemOptions(player: PlayerState): {
  equipmentSlots: number;
  equipmentMax: number;
  backpackSlots: number;
  backpackMax: number;
  safeboxSlots: number;
  safeboxMax: number;
  canEquip: boolean;
  canBackpack: boolean;
  canSafebox: boolean;
} {
  if (!player.equipmentSlots) player.equipmentSlots = [];
  if (!player.safeBox) player.safeBox = [];
  
  return {
    equipmentSlots: player.equipmentSlots.length,
    equipmentMax: 10,
    backpackSlots: player.inventory.length,
    backpackMax: BAG_SIZE,
    safeboxSlots: player.safeBox.length,
    safeboxMax: SAFE_BOX_SIZE,
    canEquip: player.equipmentSlots.length < 10,
    canBackpack: player.inventory.length < BAG_SIZE,
    canSafebox: player.safeBox.length < SAFE_BOX_SIZE,
  };
}

// 移动物品
export function moveItem(
  player: PlayerState,
  from: 'equipment' | 'backpack' | 'safebox',
  to: 'equipment' | 'backpack' | 'safebox',
  index: number
): { success: boolean; message: string } {
  if (!player.equipmentSlots) player.equipmentSlots = [];
  if (!player.safeBox) player.safeBox = [];
  
  // 获取源列表
  const sourceList = from === 'equipment' ? player.equipmentSlots 
                   : from === 'backpack' ? player.inventory 
                   : player.safeBox;
  
  // 获取目标列表
  const targetList = to === 'equipment' ? player.equipmentSlots 
                   : to === 'backpack' ? player.inventory 
                   : player.safeBox;
  
  // 目标最大容量
  const maxTarget = to === 'equipment' ? 10 
                  : to === 'backpack' ? BAG_SIZE 
                  : SAFE_BOX_SIZE;
  
  if (index < 0 || index >= sourceList.length) {
    return { success: false, message: '无效的物品位置' };
  }
  
  if (targetList.length >= maxTarget) {
    return { success: false, message: `目标位置已满（${maxTarget}/${maxTarget}）` };
  }
  
  // 移动物品
  const item = sourceList.splice(index, 1)[0];
  targetList.push(item);
  
  return { success: true, message: `物品已从${from === 'equipment' ? '装备槽' : from === 'backpack' ? '背包' : '保险箱'}移至${to === 'equipment' ? '装备槽' : to === 'backpack' ? '背包' : '保险箱'}` };
}

// 丢弃物品
export function discardItem(
  player: PlayerState,
  from: 'equipment' | 'backpack' | 'safebox',
  index: number
): { success: boolean; message: string; item?: InventoryItem } {
  if (!player.equipmentSlots) player.equipmentSlots = [];
  if (!player.safeBox) player.safeBox = [];
  
  const sourceList = from === 'equipment' ? player.equipmentSlots 
                   : from === 'backpack' ? player.inventory 
                   : player.safeBox;
  
  if (index < 0 || index >= sourceList.length) {
    return { success: false, message: '无效的物品位置' };
  }
  
  const item = sourceList.splice(index, 1)[0];
  
  return { 
    success: true, 
    message: `已丢弃物品`,
    item 
  };
}

// 计算死亡保护百分比（只计算装备槽中的active装备）
export function calculateDeathProtection(player: PlayerState): number {
  // 只考虑装备槽中的装备（active装备）
  const equipmentSlots = player.equipmentSlots || [];
  
  let totalProtection = 0;
  const MAX_DEATH_PROTECTION = 50; // 死亡概率降低上限 50%
  
  for (const item of equipmentSlots) {
    if (item.type === 'equipment') {
      const equip = item.item as Equipment;
      for (const affix of equip.affixes) {
        if (affix.type === 'death_protection') {
          totalProtection += affix.value;
        }
      }
    }
  }
  
  // 应用上限
  return Math.min(totalProtection, MAX_DEATH_PROTECTION);
}

// 检查死亡保护（随机触发）
export function checkDeathProtection(player: PlayerState): boolean {
  const totalProtection = calculateDeathProtection(player);
  // 随机触发死亡保护
  return Math.random() * 100 < totalProtection;
}

// 死亡/撤离失败结果接口
export interface DeathResult {
  equipmentLost: string[];      // 丢失的装备槽装备名称列表
  equipmentKept: string[];      // 保留的装备槽装备名称列表
  backpackLost: string[];       // 丢失的背包物品名称列表
  backpackKept: string[];       // 保留的背包物品名称列表
  droppedItems: string[];       // 本次掉落物品列表
  moneyLost: number;            // 扣除的资产
  moneyBefore: number;          // 原资产
  moneyAfter: number;           // 扣除后资产
  deathProtectionTriggered: boolean; // 是否触发死亡保护
}

// 处理死亡（高风险版）
export function handleDeath(player: PlayerState): DeathResult {
  const result: DeathResult = {
    equipmentLost: [],
    equipmentKept: [],
    backpackLost: [],
    backpackKept: [],
    droppedItems: [],
    moneyLost: 0,
    moneyBefore: player.money,
    moneyAfter: player.money,
    deathProtectionTriggered: false,
  };
  
  // 检查死亡保护
  if (checkDeathProtection(player)) {
    result.deathProtectionTriggered = true;
    result.droppedItems = [];
    player.isAlive = false;
    console.log(`[死亡逻辑] 死亡保护触发！装备已保留。`);
    return result;
  }
  
  // 初始化装备槽（兼容旧数据）
  if (!player.equipmentSlots) player.equipmentSlots = [];
  if (!player.safeBox) player.safeBox = [];
  
  // ==================================================
  // 一、装备槽处理（高风险版）
  // ==================================================
  // 丢失概率：蓝85%、紫60%、红70%、金50%
  // 白色装备作为普通装备，使用与蓝色相同的丢失率
  const EQUIPMENT_LOSS_RATES: Record<string, number> = {
    white: 0.85,   // 普通（白色）85%
    blue: 0.85,    // 蓝色（稀有）85%
    purple: 0.60,  // 紫色（精良）60%
    red: 0.70,     // 红色（传说）70%
    gold: 0.50,    // 金色（神话）50%
  };
  
  const newEquipmentSlots: InventoryItem[] = [];
  
  for (const item of player.equipmentSlots) {
    if (item.type === 'equipment') {
      const equip = item.item as Equipment;
      const lossRate = EQUIPMENT_LOSS_RATES[equip.quality] || 0.70;
      
      if (Math.random() < lossRate) {
        // 丢失
        result.equipmentLost.push(`${QUALITY_SYMBOLS[equip.quality] || '📦'}${equip.name}`);
      } else {
        // 保留
        result.equipmentKept.push(`${QUALITY_SYMBOLS[equip.quality] || '📦'}${equip.name}`);
        newEquipmentSlots.push(item);
      }
    } else {
      // 非装备物品保留
      newEquipmentSlots.push(item);
    }
  }
  
  player.equipmentSlots = newEquipmentSlots;
  
  console.log(`[死亡逻辑] 装备丢失: ${result.equipmentLost.join(', ') || '无'}, 丢失率: 蓝85%, 紫60%, 红70%, 金50%`);
  
  // ==================================================
  // 二、背包处理（高风险版）
  // ==================================================
  // 丢失概率：蓝90%、紫65%、红70%、金50%
  // 白色装备作为普通装备，使用与蓝色相同的丢失率
  const BACKPACK_LOSS_RATES: Record<string, number> = {
    white: 0.90,   // 普通（白色）90%
    blue: 0.90,    // 蓝色（稀有）90%
    purple: 0.65,  // 紫色（精良）65%
    red: 0.70,     // 红色（传说）70%
    gold: 0.50,    // 金色（神话）50%
  };
  
  const newInventory: InventoryItem[] = [];
  
  for (const item of player.inventory) {
    if (item.type === 'equipment') {
      const equip = item.item as Equipment;
      const lossRate = BACKPACK_LOSS_RATES[equip.quality] || 0.80;
      
      if (Math.random() < lossRate) {
        // 丢失
        result.backpackLost.push(`${QUALITY_SYMBOLS[equip.quality] || '📦'}${equip.name}`);
      } else {
        // 保留
        result.backpackKept.push(`${QUALITY_SYMBOLS[equip.quality] || '📦'}${equip.name}`);
        newInventory.push(item);
      }
    } else {
      // 消耗品 90% 丢失（与蓝色相同）
      if (Math.random() < 0.90) {
        result.backpackLost.push((item.item as { name: string }).name);
      } else {
        result.backpackKept.push((item.item as { name: string }).name);
        newInventory.push(item);
      }
    }
  }
  
  player.inventory = newInventory;
  
  console.log(`[死亡逻辑] 背包丢失: ${result.backpackLost.join(', ') || '无'}, 保留: ${result.backpackKept.join(', ') || '无'}, 丢失率: 蓝90%, 紫65%, 红70%, 金50%`);
  
  // ==================================================
  // 三、资产扣除
  // ==================================================
  const SURVIVE_RATIO = 0.3;  // 保留30%
  const MIN_RETENTION = 100;  // 最低保留100
  
  result.moneyBefore = player.money;
  result.moneyAfter = Math.max(Math.floor(player.money * SURVIVE_RATIO), MIN_RETENTION);
  result.moneyLost = player.money - result.moneyAfter;
  player.money = result.moneyAfter;
  
  console.log(`[死亡逻辑] 资产扣除: 原资产 ${result.moneyBefore}, 扣除后 ${result.moneyAfter}, 扣除率: 70%`);
  
  // ==================================================
  // 四、掉落生成
  // ==================================================
  // 丢失的装备加入掉落池，按品质掉落
  const droppedItems: string[] = [];
  
  // 装备槽丢失物品加入掉落
  droppedItems.push(...result.equipmentLost);
  
  // 背包丢失物品加入掉落
  droppedItems.push(...result.backpackLost);
  
  result.droppedItems = droppedItems;
  
  console.log(`[死亡逻辑] 本次掉落装备: ${droppedItems.join(', ') || '无'}`);
  
  // ==================================================
  // 五、标记死亡
  // ==================================================
  player.isAlive = false;
  
  // 综合日志
  console.log(`[死亡逻辑总览] 装备丢失: [${result.equipmentLost.join(', ')}], 背包丢失: [${result.backpackLost.join(', ')}], 掉落: [${droppedItems.join(', ')}], 资产扣除: ${result.moneyLost}`);
  
  return result;
}

// 应用装备效果到玩家状态
export function applyEquipmentEffects(player: PlayerState): void {
  // 重置加成
  player.bonusDropRate = 0;
  player.combatWinRateBonus = 0;
  player.extractRateBonus = 0;
  
  // 初始化装备槽（兼容旧数据）
  const equipmentSlots = player.equipmentSlots || [];
  const safeBox = player.safeBox || [];
  
  const allItems = [...equipmentSlots, ...player.inventory, ...safeBox];
  for (const item of allItems) {
    if (item.type === 'equipment') {
      const equip = item.item as Equipment;
      for (const affix of equip.affixes) {
        switch (affix.type) {
          case 'drop_rate':
            player.bonusDropRate += affix.value / 100;
            break;
          case 'combat_rate':
            player.combatWinRateBonus += affix.value / 100;
            break;
          case 'extract_rate':
            player.extractRateBonus += affix.value / 100;
            break;
        }
      }
    }
  }
}

// 格式化物品显示
export function formatItem(item: InventoryItem): string {
  if (item.type === 'equipment') {
    const equip = item.item as Equipment;
    return `${equip.name} (价值: ${equip.totalValue.toLocaleString()})`;
  } else {
    const res = item.item as { name: string; value: number };
    return `${res.name} (价值: ${res.value.toLocaleString()})`;
  }
}

// ========== 新增：文案生成工具函数 ==========

// 生成开红爆发文案
export function generateRedDropAnnouncement(
  playerName: string,
  quality: 'red' | 'gold',
  zoneName: string,
  value: number
): { selfMessages: string[]; broadcast: string; identityMessage: string } {
  const selfMessages = RED_DROP_ANNOUNCEMENTS.self[quality];
  const broadcastTemplates = RED_DROP_ANNOUNCEMENTS.broadcast[quality];
  
  // 随机选择自身消息（选2条）
  const selectedSelf: string[] = [];
  const shuffled = [...selfMessages].sort(() => Math.random() - 0.5);
  selectedSelf.push(shuffled[0]);
  selectedSelf.push(shuffled[1]);
  
  // 生成广播
  const broadcastTemplate = randomChoice(broadcastTemplates);
  const broadcast = broadcastTemplate
    .replace('{name}', playerName)
    .replace('{zone}', zoneName);
  
  // 身份感文案
  const identityMessage = randomChoice(RED_DROP_ANNOUNCEMENTS.identity);
  
  return {
    selfMessages: selectedSelf,
    broadcast,
    identityMessage,
  };
}

// 生成情绪诱导文案
export function generateEmotionalTip(
  failStreak: number,
  winStreak: number,
  inventoryValue: number
): string | null {
  // 优先处理连续失败
  if (failStreak >= 2) {
    const failTip = EMOTIONAL_MANIPULATION.failStreak[Math.min(failStreak, 5) as keyof typeof EMOTIONAL_MANIPULATION.failStreak];
    if (failTip) return failTip;
  }
  
  // 连续成功
  if (winStreak >= 2) {
    const winTip = EMOTIONAL_MANIPULATION.winStreak[Math.min(winStreak, 5) as keyof typeof EMOTIONAL_MANIPULATION.winStreak];
    if (winTip) return winTip;
  }
  
  // 高收益未撤
  if (inventoryValue >= 3000) {
    const thresholds = [12000, 8000, 5000, 3000];
    for (const threshold of thresholds) {
      if (inventoryValue >= threshold) {
        const template = EMOTIONAL_MANIPULATION.highValueNoExtract[threshold as keyof typeof EMOTIONAL_MANIPULATION.highValueNoExtract];
        if (template) {
          return template.replace('{value}', inventoryValue.toLocaleString());
        }
      }
    }
  }
  
  return null;
}

// 生成撤离心理博弈文案
export function generateExtractPsychology(inventoryValue: number): { conservative: string; greedy: string } {
  return {
    conservative: randomChoice(EXTRACT_PSYCHOLOGY.conservative),
    greedy: randomChoice(EXTRACT_PSYCHOLOGY.greedy),
  };
}

// 生成分享文案
export function generateShareText(trigger: 'redDrop' | 'goldDrop' | 'highProfit', value: number): string {
  const templates = SHARE_TEMPLATES[trigger];
  const template = randomChoice(templates);
  return template.replace('{value}', value.toLocaleString());
}

// 生成排行榜动态提示
export function generateLeaderboardTip(
  currentRank: number,
  totalPlayers: number,
  previousRank?: number
): string {
  // 排名下降
  if (previousRank && currentRank > previousRank) {
    return LEADERBOARD_TIPS.overtaken;
  }
  
  // 榜首
  if (currentRank === 1) {
    return LEADERBOARD_TIPS.topPlayer;
  }
  
  // 接近前3
  if (currentRank <= 5 && currentRank > 3) {
    return LEADERBOARD_TIPS.nearTop3;
  }
  
  // 接近榜首
  if (currentRank <= 3 && currentRank > 1) {
    return LEADERBOARD_TIPS.nearTop1;
  }
  
  // 超过百分比
  const percentage = Math.round(((totalPlayers - currentRank) / totalPlayers) * 100);
  return `👉 你超过了 ${percentage}% 的玩家！`;
}

// 获取强力词条的额外描述
export function getPowerfulAffixDescription(affixType: string): string | null {
  const powerfulAffix = POWERFUL_AFFIX_CONFIG.find(a => a.type === affixType);
  return powerfulAffix?.description || null;
}

// 检查是否有强力词条
export function hasPowerfulAffix(equipment: Equipment): boolean {
  const powerfulTypes = POWERFUL_AFFIX_CONFIG.map(a => a.type);
  return equipment.affixes.some(a => powerfulTypes.includes(a.type));
}
