// 叙事化服务 - 为事件生成沉浸式叙事描述

import { EventTemplate, EventOption, PlayerState, LoadLevel } from './types';
import { calculateLoadLevel } from './event-system';

// ==================== 类型定义 ====================

export interface NarrativeContext {
  exposure: number;          // 暴露度 0-10
  loadLevel: LoadLevel;      // 负重等级
  carryValue: number;        // 携带价值
  playerStyle: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  round: number;             // 当前回合
  currentZone: string;       // 当前区域
}

// ==================== 氛围描述生成 ====================

/**
 * 根据暴露度生成氛围描述
 */
export function getAtmosphereByExposure(exposure: number): string {
  if (exposure >= 8) {
    return '远处传来密集的脚步声，无线电里全是关于你的通缉令。';
  } else if (exposure >= 6) {
    return '警报声隐约可闻，巡逻队正在附近区域搜索。';
  } else if (exposure >= 4) {
    return '空气中弥漫着紧张的气息，你不时回头确认安全。';
  } else if (exposure >= 2) {
    return '四周安静得有些诡异，只有远处偶尔传来的爆炸声。';
  }
  return '废墟中一片死寂，只有风穿过破窗的呜咽声。';
}

/**
 * 根据负重生成身体状态描述
 */
export function getPhysicalState(loadLevel: LoadLevel): string {
  switch (loadLevel) {
    case 'overloaded':
      return '背包重得让你喘不过气，每一步都像是在与地心引力搏斗。';
    case 'heavy':
      return '沉甸甸的装备压在肩上，你的行动变得迟缓。';
    case 'normal':
      return '装备的重量恰到好处，你能保持良好的机动性。';
    default:
      return '轻装简行，你可以快速应对任何突发情况。';
  }
}

/**
 * 根据玩家风格生成心理状态描述
 */
export function getMentalState(playerStyle: string): string {
  switch (playerStyle) {
    case 'aggressive':
      return '肾上腺素在血管中奔涌，你的直觉告诉你：富贵险中求。';
    case 'conservative':
      return '你保持着冷静的判断，知道什么时候该进，什么时候该退。';
    case 'balanced':
      return '你权衡着风险与收益，像个老练的战术家。';
    default:
      return '你屏住呼吸，仔细观察着周围的一切。';
  }
}

// ==================== 事件叙事化 ====================

/**
 * 为事件生成叙事化描述
 */
export function generateNarrativeDescription(
  event: EventTemplate,
  context: NarrativeContext
): string {
  // 基础描述
  const baseDescription = event.description;
  
  // 根据事件类别添加不同的叙事元素
  const narrativeElements: string[] = [baseDescription];
  
  // 添加氛围描述（根据暴露度）
  const atmosphere = getAtmosphereByExposure(context.exposure);
  
  switch (event.category) {
    case 'combat':
      narrativeElements.push(getCombatNarrative(event, context));
      break;
    case 'trap':
      narrativeElements.push(getTrapNarrative(event, context));
      break;
    case 'encounter':
      narrativeElements.push(getEncounterNarrative(event, context));
      break;
    case 'resource':
      narrativeElements.push(getResourceNarrative(event, context));
      break;
    case 'movement':
      narrativeElements.push(getMovementNarrative(event, context));
      break;
    case 'escape':
      narrativeElements.push(getEscapeNarrative(event, context));
      break;
  }
  
  // 高暴露度时添加紧张氛围
  if (context.exposure >= 6) {
    narrativeElements.push(atmosphere);
  }
  
  return narrativeElements.join('\n\n');
}

/**
 * 战斗类事件叙事
 */
function getCombatNarrative(event: EventTemplate, context: NarrativeContext): string {
  const narratives: Record<string, string> = {
    'event_003': context.exposure >= 5 
      ? '他的对讲机突然响起："目标就在附近！"——你意识到自己暴露了。'
      : '卫兵的装备看起来不错，如果你能悄无声息地解决他...',
    'event_006': context.loadLevel === 'overloaded'
      ? '沉重的装备让你寸步难行，而包围圈正在收紧。'
      : '红外激光在你身上游走，敌人的枪口已经对准了这片区域。',
  };
  
  return narratives[event.id] || '';
}

/**
 * 陷阱类事件叙事
 */
function getTrapNarrative(event: EventTemplate, context: NarrativeContext): string {
  const narratives: Record<string, string> = {
    'event_004': context.playerStyle === 'aggressive'
      ? '电子锁闪烁着红光，仿佛在挑衅你："来啊，打开我。"'
      : '这个箱子在这里放了很久，电子锁的电池可能快没电了。',
    'event_009': '激光网在你眼前交织成死亡陷阱，到处都是敌人的埋伏点。',
  };
  
  return narratives[event.id] || '';
}

/**
 * 遭遇类事件叙事
 */
function getEncounterNarrative(event: EventTemplate, context: NarrativeContext): string {
  const narratives: Record<string, string> = {
    'event_002': context.carryValue >= 10000
      ? '老人盯着你鼓鼓的背包，眼神变得深邃："有钱人，要不要看看我的好货？"'
      : '老人的眼神浑浊但警觉，看起来像是这里的常客。',
    'event_005': context.playerStyle === 'aggressive'
      ? '士兵的眼神已经涣散，但他腰间的装备还在闪光。'
      : '士兵艰难地抬起头："求你...帮我..."',
  };
  
  return narratives[event.id] || '';
}

/**
 * 资源类事件叙事
 */
function getResourceNarrative(event: EventTemplate, context: NarrativeContext): string {
  const narratives: Record<string, string> = {
    'event_001': context.exposure >= 4
      ? '公寓里很安静，太安静了。你注意到地板上有人走过的痕迹。'
      : '沙发的缝隙里可能藏着东西，如果你愿意花时间翻找。',
    'event_007': '容器里的装置散发着微弱的蓝光，这是一个价值连城的战利品。',
    'event_008': context.round >= 5
      ? '运输车已经被人翻过，但角落里可能还有遗漏的物资。'
      : '运输车的后门半开着，里面的箱子散落一地。',
  };
  
  return narratives[event.id] || '';
}

/**
 * 移动类事件叙事
 */
function getMovementNarrative(event: EventTemplate, context: NarrativeContext): string {
  const narratives: Record<string, string> = {
    'event_010': context.loadLevel === 'overloaded'
      ? '如果这辆车还能发动，你就不必背着这么重的装备逃命了。'
      : '废弃的货车可以作为临时掩护，或者...修好它？',
    'event_011': '屏幕上闪烁着实时监控画面，你看到了自己的位置。',
  };
  
  return narratives[event.id] || '';
}

/**
 * 撤离类事件叙事
 */
function getEscapeNarrative(event: EventTemplate, context: NarrativeContext): string {
  if (context.exposure >= 7) {
    return '你的无线电响起："这里是撤离点，情况危急，只有一次机会！"——但这是陷阱还是救命稻草？';
  }
  return '直升机旋翼的声音从远处传来，你找到了一个紧急撤离点。';
}

// ==================== 选项叙事化 ====================

/**
 * 为选项生成叙事化描述
 */
export function generateOptionNarrative(
  option: EventOption,
  event: EventTemplate,
  context: NarrativeContext
): string {
  // 基础行动描述
  const baseAction = option.action;
  
  // 根据选项风险等级添加叙事
  const narrativeAdditions: string[] = [];
  
  // 低风险选项的心理暗示
  if (option.riskLevel === 'low') {
    if (context.playerStyle === 'aggressive') {
      narrativeAdditions.push('(有点保守，但活着才有输出)');
    } else {
      narrativeAdditions.push('(稳妥的选择)');
    }
  }
  
  // 高风险选项的诱惑描述
  if (option.riskLevel === 'high') {
    if (context.playerStyle === 'aggressive') {
      narrativeAdditions.push('(风险越大，收益越大)');
    } else {
      narrativeAdditions.push('(危险的赌博)');
    }
  }
  
  // 根据负重调整建议
  if (context.loadLevel === 'overloaded' && option.loadChange === 'increase') {
    narrativeAdditions.push('⚠️ 你已经超载了');
  }
  
  // 高暴露度时的警告
  if (context.exposure >= 6 && option.exposureChange > 0) {
    narrativeAdditions.push('⚠️ 会增加暴露度');
  }
  
  return narrativeAdditions.length > 0 
    ? `${baseAction} ${narrativeAdditions.join(' ')}`
    : baseAction;
}

// ==================== 结果叙事化 ====================

/**
 * 成功结果叙事化
 */
export function generateSuccessNarrative(
  event: EventTemplate,
  option: EventOption,
  context: NarrativeContext,
  lootValue?: number
): string {
  const successNarratives: Record<string, string> = {
    'search_careful': lootValue && lootValue >= 5000
      ? '你仔细翻找每一个角落，终于在最不可能的地方发现了宝物！'
      : '你仔细搜索了一番，找到了一些有用的物资。',
    'search_quick': '快速搜刮完成，你没有浪费时间，也没有错过值钱的东西。',
    'combat_stealth': '你像影子一样从卫兵身后溜过，他甚至不知道你来过。',
    'combat_distract': '卫兵被你扔出的响声吸引，你趁机溜进了安全区域。',
    'combat_assault': '干净利落的击倒。卫兵甚至没来得及拔枪。',
    'trap_crack': '电子锁发出"嘀"的一声，箱子缓缓打开，露出里面的宝贝。',
    'trap_break': '一声巨响，箱门被你砸开。虽然动静有点大，但东西到手了。',
    'npc_help': '士兵感激地看着你："谢谢你...往北走，那里安全。"',
    'npc_loot': '你快速搜刮了士兵身上的装备，战争从不仁慈。',
    'escape_hide': '你屏住呼吸躲在角落里，追兵从你身边跑过，没有发现你。',
    'escape_flank': '你找到敌人的盲区，悄悄绕到了安全地带。',
    'sample_careful': '你小心翼翼地取出装置，没有触发任何警报。完美。',
    'extract_call': '直升机的旋翼声越来越近，你成功了！',
  };
  
  return successNarratives[option.id] || `你的${option.action}成功了！`;
}

/**
 * 失败结果叙事化
 */
export function generateFailureNarrative(
  event: EventTemplate,
  option: EventOption,
  context: NarrativeContext
): string {
  const failureNarratives: Record<string, string> = {
    'search_careful': '你翻遍了每个角落，但这里早就被人搜刮干净了。',
    'search_quick': '你急着离开，结果什么都没找到。',
    'combat_stealth': '你的脚步声出卖了你。卫兵猛地转身，枪口对准了你的脸！',
    'combat_distract': '卫兵冷笑一声："老把戏了。"他径直朝你的方向走来。',
    'combat_assault': '你低估了对手。卫兵的反应比你想的快得多。',
    'trap_crack': '电子锁发出刺耳的警报声，红灯开始闪烁！',
    'trap_break': '爆炸比你预想的更猛烈，冲击波把你掀翻在地。',
    'npc_help': '士兵突然抓住你的手腕，大喊："来人！他在这儿！"',
    'npc_loot': '你刚碰到士兵的装备，就听到身后传来枪栓拉动的声音。',
    'escape_hide': '你的呼吸太重了。追兵循着声音找到了你。',
    'escape_flank': '你撞上了敌人的预备队，这下麻烦大了。',
    'sample_careful': '你的手抖了一下，触发了安全机制。装置开始报警！',
    'extract_call': '直升机刚要降落，就被地面的导弹击中了。',
  };
  
  return failureNarratives[option.id] || `你的${option.action}失败了！`;
}

// ==================== 状态感知叙事 ====================

/**
 * 生成当前状态的综合叙事
 */
export function generateStatusNarrative(context: NarrativeContext): string {
  const parts: string[] = [];
  
  // 身体状态
  if (context.loadLevel === 'overloaded') {
    parts.push(getPhysicalState('overloaded'));
  } else if (context.loadLevel === 'heavy') {
    parts.push(getPhysicalState('heavy'));
  }
  
  // 心理状态
  if (context.exposure >= 6) {
    parts.push('你的心跳加速，知道敌人随时可能出现。');
  }
  
  // 风格暗示
  if (context.playerStyle === 'aggressive' && context.round >= 5) {
    parts.push('已经搜了这么久，也许该考虑撤退了？');
  }
  
  return parts.join('\n');
}
