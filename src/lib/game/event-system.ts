// 事件系统 - 12个可落地事件模板

import { EventTemplate, EventResult as EventResultType, ActionType, LoadLevel, Equipment, ZoneType, EventOption } from './types';
import { dropEquipment, handleDeath, calculateInventoryValue } from './utils';
import { 
  generateSuccessNarrative, 
  generateFailureNarrative,
  NarrativeContext 
} from './narrative-service';

// 重新导出类型
export type EventResult = EventResultType;

// ==================== 常量定义 ====================

// 暴露度上限
export const MAX_EXPOSURE = 10;

// 负重阈值
export const LOAD_THRESHOLDS = {
  light: 3000,
  normal: 8000,
  heavy: 15000,
  // 超载 = 超过15000
};

// 暴露度上限（按负重等级）
export const EXPOSURE_LIMIT_BY_LOAD: Record<LoadLevel, number> = {
  light: 10,
  normal: 8,
  heavy: 5,
  overloaded: 3,
};

// 行动类型成功率修正
export const ACTION_RATE_MODIFIER: Record<ActionType, { success: number; reward: number; exposure: number }> = {
  stealth: { success: 15, reward: -20, exposure: -50 },   // 潜行：成功率+15%，收益-20%，暴露-50%
  search: { success: 0, reward: 0, exposure: 0 },           // 搜索：正常
  assault: { success: -20, reward: 30, exposure: 100 },     // 突击：成功率-20%，收益+30%，暴露+100%
};

// 负重成功率修正
export const LOAD_RATE_MODIFIER: Record<LoadLevel, { all: number; combat: number }> = {
  light: { all: 5, combat: 5 },
  normal: { all: 0, combat: 0 },
  heavy: { all: -5, combat: -10 },
  overloaded: { all: -15, combat: -25 },
};

// ==================== 12个事件模板 ====================

export const GAME_EVENTS: EventTemplate[] = [
  // ==================== 事件1：空置公寓搜索 ====================
  {
    id: 'event_001',
    name: '空置公寓搜索',
    zone: 'normal',
    category: 'resource',
    triggerExposure: { min: 0, max: 3 },
    description: '一间门窗破损的公寓，内部漆黑，隐约可见翻倒的家具。',
    options: [
      {
        id: 'search_careful',
        text: '🔍 仔细搜索',
        action: '仔细搜索公寓内部',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 75,
        rewardChange: 0,
        riskLevel: 'medium',
      },
      {
        id: 'search_quick',
        text: '⚡ 快速搜刮',
        action: '快速搜刮值钱物品',
        exposureChange: 0,
        loadChange: 'none',
        successRate: 90,
        rewardChange: -40,
        riskLevel: 'low',
      },
    ],
    recommendExtract: false,
    aiAdvice: '这个公寓值得花时间搜。以你当前的暴露度，直接仔细搜就行。',
    reportLine: '回合{N}：在空置公寓仔细搜索，发现了战利品。',
    weight: 20,
  },

  // ==================== 事件2：流浪商人 ====================
  {
    id: 'event_002',
    name: '流浪商人',
    zone: 'normal',
    category: 'encounter',
    triggerExposure: { min: 2, max: 5 },
    description: '一个背着大包的老人蹲在墙角，示意你有装备可以交易。',
    options: [
      {
        id: 'trade_browse',
        text: '💰 查看货物',
        action: '查看商人的货物',
        exposureChange: 1,
        loadChange: 'increase',
        successRate: 100,
        rewardChange: 0,
        riskLevel: 'low',
      },
      {
        id: 'trade_intel',
        text: '🗣️ 打听情报',
        action: '向商人打听情报',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 60,
        rewardChange: -100,
        riskLevel: 'low',
      },
      {
        id: 'trade_leave',
        text: '🚶 直接离开',
        action: '礼貌地离开',
        exposureChange: 0,
        loadChange: 'none',
        successRate: 100,
        rewardChange: -100,
        riskLevel: 'low',
      },
    ],
    recommendExtract: false,
    aiAdvice: '身上有蓝装就换掉。这个老人不危险，但别暴露太多。',
    reportLine: '回合{N}：与流浪商人交易，换取了装备并打听到附近的安全区域。',
    weight: 15,
  },

  // ==================== 事件3：巡逻卫兵 ====================
  {
    id: 'event_003',
    name: '巡逻卫兵',
    zone: 'dangerous',
    category: 'combat',
    triggerExposure: { min: 3, max: 6 },
    description: '一名武装卫兵背对着你，正在检查仓库入口。',
    options: [
      {
        id: 'combat_stealth',
        text: '🥷 潜行绕后',
        action: '悄悄绕到卫兵身后',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 70,
        rewardChange: 0,
        riskLevel: 'medium',
      },
      {
        id: 'combat_distract',
        text: '🔊 声东击西',
        action: '制造声响吸引注意力',
        exposureChange: 2,
        loadChange: 'none',
        successRate: 85,
        rewardChange: 0,
        riskLevel: 'medium',
      },
      {
        id: 'combat_assault',
        text: '⚔️ 直接击倒',
        action: '直接冲上去战斗',
        exposureChange: 3,
        loadChange: 'none',
        successRate: 55,
        rewardChange: 30,
        riskLevel: 'high',
      },
    ],
    recommendExtract: true,
    aiAdvice: '他背对着你，但别冲动。潜行最稳，声东击西收益高但暴露多。',
    reportLine: '回合{N}：遭遇巡逻卫兵，选择了潜行战术，成功通过。',
    weight: 18,
  },

  // ==================== 事件4：上锁军火箱 ====================
  {
    id: 'event_004',
    name: '上锁军火箱',
    zone: 'dangerous',
    category: 'trap',
    triggerExposure: { min: 2, max: 5 },
    description: '一个厚重的金属箱，上面有明显的电子锁和红色警示灯。',
    options: [
      {
        id: 'trap_crack',
        text: '🔓 技术破解',
        action: '尝试破解电子锁',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 50,
        rewardChange: 0,
        riskLevel: 'medium',
      },
      {
        id: 'trap_break',
        text: '💥 暴力破拆',
        action: '直接砸开箱子',
        exposureChange: 3,
        loadChange: 'none',
        successRate: 70,
        rewardChange: -20,
        riskLevel: 'high',
      },
      {
        id: 'trap_findkey',
        text: '🔍 寻找钥匙',
        action: '在附近寻找钥匙',
        exposureChange: 0,
        loadChange: 'none',
        successRate: 30,
        rewardChange: 0,
        riskLevel: 'low',
      },
    ],
    recommendExtract: false,
    aiAdvice: '这个箱子里有好东西。技术破解最稳，但需要时间。暴力拆最快但会响。',
    reportLine: '回合{N}：发现了上锁军火箱，破解后获得了高价值装备。',
    weight: 15,
  },

  // ==================== 事件5：伤员求救 ====================
  {
    id: 'event_005',
    name: '伤员求救',
    zone: 'dangerous',
    category: 'encounter',
    triggerExposure: { min: 2, max: 4 },
    description: '一名受伤的士兵靠坐在墙角，用微弱的声音喊"救命"。',
    options: [
      {
        id: 'npc_help',
        text: '🩹 救助伤员',
        action: '帮助受伤的士兵',
        exposureChange: 0,
        loadChange: 'none',
        successRate: 100,
        rewardChange: -100,
        riskLevel: 'low',
      },
      {
        id: 'npc_loot',
        text: '💀 搜刮装备',
        action: '搜刮士兵身上的装备',
        exposureChange: 2,
        loadChange: 'increase',
        successRate: 100,
        rewardChange: 50,
        riskLevel: 'medium',
      },
      {
        id: 'npc_ignore',
        text: '🚶 无视离开',
        action: '直接离开',
        exposureChange: 0,
        loadChange: 'none',
        successRate: 100,
        rewardChange: -100,
        riskLevel: 'low',
      },
    ],
    recommendExtract: false,
    aiAdvice: '帮他一把能降低暴露度，但他可能引来敌人。搜刮装备最实际，但有道德风险。',
    reportLine: '回合{N}：遇到伤员，选择帮助，获得了他提供的情报，暴露度降低。',
    weight: 12,
  },

  // ==================== 事件6：武装反应 ====================
  {
    id: 'event_006',
    name: '武装反应',
    zone: 'boss',
    category: 'combat',
    triggerExposure: { min: 4, max: 7 },
    description: '红外报警器亮起，远处传来脚步声，至少3人正在向你靠近。',
    options: [
      {
        id: 'escape_hide',
        text: '🛡️ 隐蔽等待',
        action: '找个角落隐蔽起来',
        exposureChange: -2,
        loadChange: 'none',
        successRate: 60,
        rewardChange: -100,
        riskLevel: 'medium',
      },
      {
        id: 'escape_breakout',
        text: '⚔️ 正面突围',
        action: '全力冲出包围圈',
        exposureChange: 2,
        loadChange: 'none',
        successRate: 40,
        rewardChange: -100,
        riskLevel: 'high',
      },
      {
        id: 'escape_flank',
        text: '🥷 侧翼包抄',
        action: '寻找侧翼突破口',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 65,
        rewardChange: 0,
        riskLevel: 'medium',
      },
    ],
    recommendExtract: true,
    aiAdvice: '你的暴露度太高了。隐蔽等他们走，或者直接撤。硬拼不划算。',
    reportLine: '回合{N}：触发警报，选择隐蔽等待，成功躲过追兵。',
    weight: 15,
  },

  // ==================== 事件7：稀有样本 ====================
  {
    id: 'event_007',
    name: '稀有样本容器',
    zone: 'boss',
    category: 'resource',
    triggerExposure: { min: 0, max: 3 },
    description: '一个发着冷光的容器，里面悬浮着某种高科技装置，标注着"危险品-请勿触碰"。',
    options: [
      {
        id: 'sample_careful',
        text: '🔬 谨慎取出',
        action: '小心地取出装置',
        exposureChange: 1,
        loadChange: 'increase',
        loadPercent: 30,
        successRate: 80,
        rewardChange: 50,
        riskLevel: 'medium',
      },
      {
        id: 'sample_grab',
        text: '🤚 直接拿走',
        action: '直接伸手去拿',
        exposureChange: 3,
        loadChange: 'increase',
        loadPercent: 50,
        successRate: 40,
        rewardChange: 30,
        riskLevel: 'high',
      },
      {
        id: 'sample_record',
        text: '📸 拍照记录',
        action: '记录位置后离开',
        exposureChange: 0,
        loadChange: 'none',
        successRate: 100,
        rewardChange: -100,
        riskLevel: 'low',
      },
    ],
    recommendExtract: true,
    aiAdvice: '这东西值大红装，但拿了就跑。你现在是重装，撤离成功率已经-20%了。',
    reportLine: '回合{N}：在实验室深处发现了稀有样本，谨慎取走后获得顶级装备。',
    weight: 10,
  },

  // ==================== 事件8：运输车残骸 ====================
  {
    id: 'event_008',
    name: '运输车残骸',
    zone: 'any',
    category: 'resource',
    triggerExposure: { min: 3, max: 6 },
    description: '一辆翻倒的运输车，车厢半开着，里面散落着一些物资箱。',
    options: [
      {
        id: 'vehicle_full',
        text: '🔍 全面搜索',
        action: '彻底搜查整辆车',
        exposureChange: 2,
        loadChange: 'increase',
        loadPercent: 50,
        successRate: 75,
        rewardChange: 0,
        riskLevel: 'medium',
      },
      {
        id: 'vehicle_quick',
        text: '⏱️ 只拿必需品',
        action: '快速拿走值钱的东西',
        exposureChange: 0,
        loadChange: 'increase',
        loadPercent: 20,
        successRate: 100,
        rewardChange: -30,
        riskLevel: 'low',
      },
      {
        id: 'vehicle_trap',
        text: '🪤 设置陷阱',
        action: '设置陷阱后标记位置',
        exposureChange: 0,
        loadChange: 'none',
        successRate: 100,
        rewardChange: -100,
        riskLevel: 'low',
      },
    ],
    recommendExtract: false,
    aiAdvice: '全面搜收益高，但你已经重装了。快速拿一件走最稳。',
    reportLine: '回合{N}：发现了翻倒的运输车，快速取走了必需的物资。',
    weight: 18,
  },

  // ==================== 事件9：伏击陷阱 ====================
  {
    id: 'event_009',
    name: '伏击陷阱',
    zone: 'any',
    category: 'trap',
    triggerExposure: { min: 5, max: 8 },
    description: '你踩到了细线，周围突然亮起红色激光，传来敌人大喊"抓住他！"',
    options: [
      {
        id: 'ambush_static',
        text: '🧎 趴下静止',
        action: '立刻趴下不动',
        exposureChange: -1,
        loadChange: 'none',
        successRate: 50,
        rewardChange: -100,
        riskLevel: 'medium',
      },
      {
        id: 'ambush_roll',
        text: '💨 翻滚躲避',
        action: '快速翻滚躲避激光',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 65,
        rewardChange: -100,
        riskLevel: 'medium',
      },
      {
        id: 'ambush_fight',
        text: '🔫 拔枪还击',
        action: '向来袭者开火',
        exposureChange: 3,
        loadChange: 'none',
        successRate: 35,
        rewardChange: 50,
        riskLevel: 'high',
      },
    ],
    recommendExtract: true,
    aiAdvice: '趴下最稳，但不一定管用。你暴露度太高了，撤是首选。',
    reportLine: '回合{N}：触发伏击陷阱，选择翻滚躲避，成功脱离危险。',
    weight: 15,
  },

  // ==================== 事件10：废弃车辆 ====================
  {
    id: 'event_010',
    name: '废弃车辆',
    zone: 'normal',
    category: 'movement',
    triggerExposure: { min: 2, max: 5 },
    description: '一辆半埋在废墟中的旧货车，车门还能打开，引擎似乎还能发动。',
    options: [
      {
        id: 'car_repair',
        text: '🔧 修好开走',
        action: '尝试修理车辆',
        exposureChange: 2,
        loadChange: 'none',
        successRate: 40,
        rewardChange: -100,
        riskLevel: 'medium',
      },
      {
        id: 'car_loot',
        text: '💰 搜刮后离开',
        action: '搜刮车内物资后离开',
        exposureChange: 1,
        loadChange: 'increase',
        loadPercent: 30,
        successRate: 85,
        rewardChange: 0,
        riskLevel: 'low',
      },
      {
        id: 'car_cover',
        text: '🛡️ 当作掩护',
        action: '利用车辆作为掩护点',
        exposureChange: -1,
        loadChange: 'none',
        successRate: 100,
        rewardChange: -100,
        riskLevel: 'low',
      },
    ],
    recommendExtract: false,
    aiAdvice: '修好车能快速撤离，但失败了会浪费时间。当掩护最稳，降低遭遇风险。',
    reportLine: '回合{N}：发现了废弃车辆，决定当作掩护，躲避了可能的追兵。',
    weight: 12,
  },

  // ==================== 事件11：情报终端 ====================
  {
    id: 'event_011',
    name: '情报终端',
    zone: 'dangerous',
    category: 'movement',
    triggerExposure: { min: 1, max: 4 },
    description: '一台还在运转的军用电脑，屏幕上显示着基地的实时监控画面。',
    options: [
      {
        id: 'terminal_download',
        text: '📥 下载情报',
        action: '下载敌方巡逻路线',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 70,
        rewardChange: -100,
        riskLevel: 'low',
      },
      {
        id: 'terminal_cut',
        text: '🔌 切断监控',
        action: '切断该区域的监控',
        exposureChange: 2,
        loadChange: 'none',
        successRate: 80,
        rewardChange: -100,
        riskLevel: 'medium',
      },
      {
        id: 'terminal_virus',
        text: '🦠 植入病毒',
        action: '向系统植入病毒',
        exposureChange: 3,
        loadChange: 'none',
        successRate: 45,
        rewardChange: -100,
        riskLevel: 'high',
      },
    ],
    recommendExtract: false,
    aiAdvice: '下载情报最稳，下次行动暴露更低。植入病毒收益最大但风险也最高。',
    reportLine: '回合{N}：入侵了情报终端，获得了敌方巡逻路线，暴露度降低。',
    weight: 10,
  },

  // ==================== 事件12：紧急撤离点 ====================
  {
    id: 'event_012',
    name: '紧急撤离点',
    zone: 'boss',
    category: 'escape',
    triggerExposure: { min: 6, max: 10 },
    description: '你发现了直升机紧急撤离点，但不确定这是陷阱还是真正的撤离点。',
    options: [
      {
        id: 'extract_call',
        text: '🚁 呼叫撤离',
        action: '立即呼叫直升机',
        exposureChange: -5,
        loadChange: 'none',
        successRate: 70,
        rewardChange: 0,
        riskLevel: 'medium',
      },
      {
        id: 'extract_scout',
        text: '👁️ 侦查确认',
        action: '先侦查确认安全',
        exposureChange: 1,
        loadChange: 'none',
        successRate: 75,
        rewardChange: 0,
        riskLevel: 'low',
      },
      {
        id: 'extract_ambush',
        text: '🪤 设置伏击',
        action: '设置伏击等待来者',
        exposureChange: 2,
        loadChange: 'none',
        successRate: 55,
        rewardChange: 50,
        riskLevel: 'high',
      },
    ],
    recommendExtract: true,
    aiAdvice: '暴露度太高了，别犹豫，直接叫撤离。侦查有风险，伏击赌性太大。',
    reportLine: '回合{N}：在危急时刻找到紧急撤离点，成功脱离战区。',
    weight: 15,
  },
];

// ==================== 事件引擎 ====================

/**
 * 根据暴露度和区域获取可用事件
 */
export function getAvailableEvents(
  exposure: number,
  zone: ZoneType
): EventTemplate[] {
  return GAME_EVENTS.filter(event => {
    // 检查暴露度范围
    const inExposureRange = exposure >= event.triggerExposure.min && 
                            exposure <= event.triggerExposure.max;
    
    // 检查区域匹配
    const zoneMatch = event.zone === 'any' || event.zone === zone;
    
    return inExposureRange && zoneMatch;
  });
}

/**
 * 根据权重随机选择一个事件
 */
export function selectRandomEvent(
  exposure: number,
  zone: ZoneType
): EventTemplate | null {
  const available = getAvailableEvents(exposure, zone);
  
  if (available.length === 0) {
    return null;
  }
  
  // 按权重计算总权重
  const totalWeight = available.reduce((sum, e) => sum + e.weight, 0);
  
  // 随机选择
  let random = Math.random() * totalWeight;
  
  for (const event of available) {
    random -= event.weight;
    if (random <= 0) {
      return event;
    }
  }
  
  // 兜底返回第一个
  return available[0];
}

/**
 * 计算负重等级
 */
export function calculateLoadLevel(totalValue: number): LoadLevel {
  if (totalValue < LOAD_THRESHOLDS.light) return 'light';
  if (totalValue < LOAD_THRESHOLDS.normal) return 'normal';
  if (totalValue < LOAD_THRESHOLDS.heavy) return 'heavy';
  return 'overloaded';
}

/**
 * 计算负重上限
 */
export function getExposureLimit(loadLevel: LoadLevel): number {
  return EXPOSURE_LIMIT_BY_LOAD[loadLevel];
}

/**
 * 处理事件选择结果
 */
export function processEventChoice(
  event: EventTemplate,
  optionId: string,
  player: any,
  actionType: ActionType
): EventResult {
  const option = event.options.find(o => o.id === optionId);
  
  if (!option) {
    return {
      success: false,
      message: '无效的选择',
      exposureChange: 0,
      loadChange: 0,
      rewardChange: 0,
    };
  }
  
  // 计算修正后的成功率
  const loadLevel = calculateLoadLevel(calculateInventoryValue(player));
  const loadMod = LOAD_RATE_MODIFIER[loadLevel];
  const actionMod = ACTION_RATE_MODIFIER[actionType];
  
  let successRate = option.successRate + actionMod.success + loadMod.all;
  successRate = Math.max(5, Math.min(95, successRate)); // 限制在5%-95%
  
  // 计算成功
  const isSuccess = Math.random() * 100 < successRate;
  
  // 计算暴露度变化
  let exposureChange = option.exposureChange;
  if (actionType === 'stealth') {
    exposureChange = Math.floor(exposureChange * 0.5); // 潜行减半
  } else if (actionType === 'assault') {
    exposureChange = Math.ceil(exposureChange * 2); // 突击翻倍
  }
  
  // 计算收益变化
  let rewardChange = option.rewardChange + actionMod.reward;
  
  // 初始化结果
  const result: EventResult = {
    success: isSuccess,
    message: '',
    exposureChange,
    loadChange: 0,
    rewardChange,
  };
  
  // 构建叙事化上下文
  const narrativeContext: NarrativeContext = {
    exposure: player.exposure || 0,
    loadLevel,
    carryValue: calculateInventoryValue(player),
    playerStyle: player.styleTag || 'unknown',
    round: player.currentRound || 1,
    currentZone: player.currentZone || 'normal',
  };
  
  // 生成结果
  if (isSuccess) {
    // 成功结果
    if (option.rewardChange > -100) {
      // 生成装备
      const { equipment } = dropEquipment(
        player.currentZone as ZoneType || 'normal',
        player
      );
      
      // 应用收益变化
      if (rewardChange !== 0) {
        equipment.totalValue = Math.floor(equipment.totalValue * (1 + rewardChange / 100));
      }
      
      result.loot = equipment;
      result.isRedDrop = equipment.quality === 'red' || equipment.quality === 'gold';
      
      if (result.isRedDrop) {
        result.broadcast = `🔔 ${player.name} 在事件中获得了一件 ${equipment.name}！`;
      }
    }
    
    result.message = generateSuccessMessage(event, option, result, narrativeContext);
    
  } else {
    // 失败结果
    result.message = generateFailureMessage(event, option, narrativeContext);
    
    // 战斗类事件失败可能导致死亡
    if (event.category === 'combat' || event.category === 'trap') {
      const deathResult = handleDeath(player);
      result.isDeath = !deathResult.deathProtectionTriggered;
      result.deathResult = deathResult;
      
      if (result.isDeath) {
        result.message += '\n\n💀 ' + deathResult.moneyLost + '资产损失';
      } else {
        result.message += '\n\n🛡️ 死亡保护触发！装备已保留。';
      }
    }
  }
  
  // 计算负重变化
  if (option.loadChange !== 'none' && result.loot) {
    const lootValue = result.loot.totalValue;
    if (option.loadChange === 'increase') {
      const percent = option.loadPercent || 30;
      result.loadChange = Math.floor(lootValue * percent / 100);
    }
  }
  
  return result;
}

/**
 * 生成成功消息
 */
function generateSuccessMessage(
  event: EventTemplate, 
  option: EventOption, 
  result: EventResult,
  context?: NarrativeContext
): string {
  // 使用叙事化服务生成消息
  if (context) {
    const narrative = generateSuccessNarrative(event, option, context, result.loot?.totalValue);
    // 如果叙事化服务返回了内容，优先使用
    if (narrative) return narrative;
  }
  
  // 兜底：使用原有消息
  const messages: Record<string, string> = {
    'search_careful': '🔍 你仔细搜索了公寓，在沙发底下发现了一件装备！',
    'search_quick': '⚡ 你快速搜刮，拿到了一些值钱的东西。',
    'trade_browse': '💰 你与商人交换了装备，他给了你一件更好的。',
    'trade_intel': '🗣️ 商人告诉你一个隐蔽的物资点位置。',
    'trade_leave': '🚶 你礼貌地离开了。',
    'combat_stealth': '🥷 你悄悄绕到卫兵身后，成功潜入。',
    'combat_distract': '🔊 卫兵被声音吸引离开，你趁机进入。',
    'combat_assault': '⚔️ 你突袭成功，击倒了卫兵并缴获装备！',
    'trap_crack': '🔓 电子锁被你破解，箱子里有好东西！',
    'trap_break': '💥 暴力破拆成功，虽然有点损坏但拿到了装备！',
    'trap_findkey': '🔍 你在角落找到了钥匙，完美开箱！',
    'npc_help': '🩹 你帮助了伤员，他告诉你一个安全的位置。',
    'npc_loot': '💀 你搜刮了士兵的装备，他的东西还不错。',
    'npc_ignore': '🚶 你选择了无视，快速离开。',
    'escape_hide': '🛡️ 你隐蔽得很好，追兵离开了。',
    'escape_breakout': '⚔️ 你杀出重围，虽然狼狈但成功了！',
    'escape_flank': '🥷 你找到突破口，侧翼击杀一人后逃脱。',
    'sample_careful': '🔬 你谨慎地取出装置，成功获得稀有样本！',
    'sample_grab': '🤚 你一把抓起装置，还好没出事！',
    'sample_record': '📸 你记录了位置，这些情报可以卖给商人。',
    'vehicle_full': '🔍 你全面搜索，发现了不少好东西！',
    'vehicle_quick': '⏱️ 你快速拿走必需品，没有浪费时间。',
    'vehicle_trap': '🪤 你设置了陷阱，标记好位置。',
    'ambush_static': '🧎 你趴下不动，激光关闭了。',
    'ambush_roll': '💨 你翻滚躲避，躲过了激光网。',
    'ambush_fight': '🔫 你果断开火，击杀了来袭者！',
    'car_repair': '🔧 你修好了车！可以快速撤离了！',
    'car_loot': '💰 你搜刮了车内物资。',
    'car_cover': '🛡️ 你把车辆当作掩护，躲避了追踪。',
    'terminal_download': '📥 你下载了巡逻情报，暴露风险降低。',
    'terminal_cut': '🔌 你切断了监控，该区域安全了。',
    'terminal_virus': '🦠 病毒植入成功，全区域警报失效！',
    'extract_call': '🚁 直升机来了！你成功撤离！',
    'extract_scout': '👁️ 侦查确认安全，100%撤离成功！',
    'extract_ambush': '🪤 你伏击了来接应的敌人，获得大量装备！',
  };
  
  return messages[option.id] || `✅ ${option.action}成功！`;
}

/**
 * 生成失败消息
 */
function generateFailureMessage(
  event: EventTemplate, 
  option: EventOption,
  context?: NarrativeContext
): string {
  // 使用叙事化服务生成消息
  if (context) {
    const narrative = generateFailureNarrative(event, option, context);
    // 如果叙事化服务返回了内容，优先使用
    if (narrative) return narrative;
  }
  
  // 兜底：使用原有消息
  const messages: Record<string, string> = {
    'search_careful': '🔍 你仔细搜索了一番，但什么都没找到。',
    'search_quick': '⚡ 你快速搜刮，但只拿到一些垃圾。',
    'combat_stealth': '🥷 你被发现，卫兵向你开火！',
    'combat_distract': '🔊 卫兵识破了你的把戏！',
    'combat_assault': '⚔️ 你被反杀！',
    'trap_crack': '🔓 破解失败，触发了警报！',
    'trap_break': '💥 爆炸！你被波及受伤！',
    'trap_findkey': '🔍 你没找到钥匙，浪费时间。',
    'npc_help': '🩹 伤员招来了敌人！',
    'npc_loot': '💀 你被其他人发现了！',
    'escape_hide': '🛡️ 你被发现了！',
    'escape_breakout': '⚔️ 你没能突围！',
    'escape_flank': '🥷 你被发现了！',
    'sample_careful': '🔬 装置损坏，你只拿到一部分。',
    'sample_grab': '🤚 陷阱触发！装置爆炸。',
    'vehicle_full': '🔍 你浪费时间，什么都没找到。',
    'car_repair': '🔧 修车失败，浪费时间。',
    'ambush_static': '🧎 你被发现了！',
    'ambush_roll': '💨 你被激光击中！',
    'ambush_fight': '🔫 你被击杀了！',
    'terminal_download': '📥 下载失败，被发现了！',
    'terminal_cut': '🔌 切断失败，触发了警报！',
    'terminal_virus': '🦠 病毒被发现，系统锁定！',
    'extract_call': '🚁 直升机被击落！',
    'extract_scout': '👁️ 侦查暴露了位置！',
    'extract_ambush': '🪤 伏击失败，你被包围！',
  };
  
  return messages[option.id] || `❌ ${option.action}失败！`;
}

/**
 * 生成战报记录
 */
export function generateReportLine(event: EventTemplate, optionId: string, round: number): string {
  const option = event.options.find((o: EventOption) => o.id === optionId);
  if (!option) return '';
  
  return event.reportLine.replace('{N}', String(round));
}

// ==================== AI建议生成 ====================

export interface AIAdviceContext {
  carryValue: number;
  exposure: number;
  loadLevel: LoadLevel;
  exposureLimit: number;
  riskStars: number;
  styleTag: string;
  currentZone: string;
  currentEvent?: EventTemplate;
}

export function generateAIAdvice(context: AIAdviceContext): string {
  const { carryValue, exposure, loadLevel, exposureLimit, riskStars, styleTag, currentZone, currentEvent } = context;
  
  // 高暴露度警告
  if (exposure >= 7) {
    return `🚨 极度危险！暴露度${exposure}已接近上限${exposureLimit}。
    
💀 分析：
• 你被盯上了！继续行动基本等于送死
• 遇到敌人=死亡
• 建议立即寻找撤离点

🎯 命令：
"别想了，现在就撤！"`;
  }
  
  // 超载警告
  if (loadLevel === 'overloaded') {
    return `⚠️⚠️⚠️ 超载警告！

📊 状态：
• 携带价值 ${carryValue.toLocaleString()}（超载）
• 撤离成功率 -40%
• 遭遇战斗=跑不掉

💀 危险：
"命比装备重要！
 建议立即清理背包，只留红装金装。"`;
  }
  
  // 重装警告
  if (loadLevel === 'heavy') {
    return `⚠️ 重装状态

📊 状态：
• 携带 ${carryValue.toLocaleString()}（重装）
• 撤离成功率 -20%
• 暴露上限 ${exposureLimit} 星

🤔 建议：
"重装状态别浪了。
 再搜1-2次就该撤了。"`;
  }
  
  // 有当前事件时的建议
  if (currentEvent) {
    const safeOption = currentEvent.options.find(o => o.riskLevel === 'low');
    const riskyOption = currentEvent.options.find(o => o.riskLevel === 'high');
    
    return `📋 当前事件：${currentEvent.name}

${currentEvent.description}

💡 AI分析：
${safeOption ? `• 🟢 推荐：${safeOption.text} - ${safeOption.riskLevel === 'low' ? '最稳选择' : '风险低'}` : ''}
${riskyOption ? `• 🔴 激进：${riskyOption.text} - ${riskyOption.rewardChange > 0 ? '+' + riskyOption.rewardChange + '%收益' : '高风险'}` : ''}

${currentEvent.aiAdvice}`;
  }
  
  // 常规局势
  const safeOrRisk = styleTag === 'aggressive' ? '可以激进' : styleTag === 'conservative' ? '建议稳健' : '均衡即可';
  
  return `🧠 AI战术参谋

📊 当前状态：
• 💎 携带 ${carryValue.toLocaleString()}（${loadLevel === 'light' ? '轻装' : loadLevel === 'normal' ? '标准' : '重装'}）
• ☁️ 暴露 ${exposure}/${exposureLimit}
• 🎯 风险 ${'⭐'.repeat(riskStars)}

📋 分析：
"你现在的状态${safeOrRisk}。
 暴露${exposure}不算高，可以继续搜。"`;
}
