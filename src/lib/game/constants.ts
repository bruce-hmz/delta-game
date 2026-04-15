// 游戏常量配置

import { Quality, ZoneType } from './types';

// 初始资金
export const INITIAL_MONEY = 1000;

// 背包容量
export const BAG_SIZE = 5;

// 保险箱容量
export const SAFE_BOX_SIZE = 10;

// 基础撤离率
export const BASE_EXTRACT_RATE = 0.8;

// 各区域战斗遭遇率
export const COMBAT_RATES: Record<ZoneType, number> = {
  normal: 0.1,
  dangerous: 0.3,
  boss: 0.6,
};

// 各区域独立死亡概率（探索本身的风险，与战斗无关）
export const ZONE_DEATH_RATES: Record<ZoneType, number> = {
  normal: 0.05,      // 废弃居民区：5% 死亡风险
  dangerous: 0.15,   // 军事仓库：15% 死亡风险
  boss: 0.30,        // 黑区实验室：30% 死亡风险
};

// 基础战斗胜率
export const BASE_COMBAT_WIN_RATE = 0.5;

// 各区域掉落概率
export const DROP_RATES: Record<ZoneType, Record<Quality, number>> = {
  normal: {
    white: 0.6,
    blue: 0.25,
    purple: 0.1,
    red: 0.04,
    gold: 0.01,
  },
  dangerous: {
    white: 0,
    blue: 0.4,
    purple: 0.3,
    red: 0.2,
    gold: 0.1,
  },
  boss: {
    white: 0,
    blue: 0,
    purple: 0.3,
    red: 0.4,
    gold: 0.3,
  },
};

// 品质配置
export const QUALITY_CONFIG: Record<Quality, {
  color: string;
  name: string;
  affixCount: number;
  valueMultiplier: number;
  emoji: string;
}> = {
  white: {
    color: '#ffffff',
    name: '普通',
    affixCount: 1,
    valueMultiplier: 1,
    emoji: '⚪',
  },
  blue: {
    color: '#4a90e2',
    name: '精良',
    affixCount: 1,
    valueMultiplier: 2,
    emoji: '🔵',
  },
  purple: {
    color: '#a855f7',
    name: '稀有',
    affixCount: 2,
    valueMultiplier: 5,
    emoji: '🟣',
  },
  red: {
    color: '#ef4444',
    name: '史诗',
    affixCount: 3,
    valueMultiplier: 15,
    emoji: '🔴',
  },
  gold: {
    color: '#fbbf24',
    name: '传说',
    affixCount: 4,
    valueMultiplier: 50,
    emoji: '🟡',
  },
};

// 装备名称库
export const EQUIPMENT_NAMES: Record<Quality, string[]> = {
  white: [
    '基础弹药',
    '医疗包',
    '战术背心',
    '防弹插板',
    '简易绷带',
    '能量饮料',
  ],
  blue: [
    '战术瞄准镜',
    '消音器',
    '扩容弹匣',
    '战术护膝',
    '快速弹夹',
    '增强护甲',
  ],
  purple: [
    '高级战术模块',
    '纳米修复系统',
    '增强外骨骼',
    '智能瞄准辅助',
    '热成像瞄准器',
    '电磁护盾',
  ],
  red: [
    '战术核心模块',
    '量子处理器',
    '等离子推进器',
    '能量护盾发生器',
    '神经链接装置',
    '时序加速器',
  ],
  gold: [
    '远古神器',
    '星际核心',
    '永恒之钥',
    '创世模块',
    '神话引擎',
    '命运罗盘',
  ],
};

// 词条配置 - 普通词条
export const AFFIX_CONFIG = [
  {
    type: 'value_bonus',
    min: 5,
    max: 25,
    getDescription: (value: number) => `价值+${value}%`,
    isPowerful: false,
  },
  {
    type: 'extract_rate',
    min: 5,
    max: 20,
    getDescription: (value: number) => `撤离成功率+${value}%`,
    isPowerful: false,
  },
  {
    type: 'combat_rate',
    min: 5,
    max: 25,
    getDescription: (value: number) => `战斗胜率+${value}%`,
    isPowerful: false,
  },
  {
    type: 'bag_size',
    min: 1,
    max: 2,
    getDescription: (value: number) => `背包容量+${value}`,
    isPowerful: false,
  },
  {
    type: 'drop_rate',
    min: 3,
    max: 10,
    getDescription: (value: number) => `下次开红概率+${value}%`,
    isPowerful: false,
  },
  {
    type: 'death_protection',
    min: 5,
    max: 15,
    getDescription: (value: number) => `死亡保护(${value}%概率不掉落)`,
    isPowerful: false,
  },
];

// 强力词条配置（红/金装备必出至少1条）
export const POWERFUL_AFFIX_CONFIG = [
  {
    type: 'guaranteed_red',
    value: 1,
    getDescription: () => '🎯 本局必出红装（一次）',
    description: '这个词条足以改变整局命运！',
  },
  {
    type: 'death_immunity',
    value: 1,
    getDescription: () => '🛡️ 死亡不掉落（一次）',
    description: '拥有它，你可以放心大胆地赌！',
  },
  {
    type: 'extract_guaranteed',
    value: 1,
    getDescription: () => '✅ 撤离失败自动成功',
    description: '无论发生什么，你都能安全撤离！',
  },
  {
    type: 'combat_guaranteed',
    value: 1,
    getDescription: () => '⚔️ 战斗必胜（一次）',
    description: '无敌的力量，没有任何敌人能阻挡你！',
  },
  {
    type: 'next_red_boost',
    value: 20,
    getDescription: () => '🔥 下回合红装概率+20%',
    description: '下一把，注定不平凡！',
  },
  {
    type: 'bag_expand',
    value: 3,
    getDescription: () => '🎒 背包容量+3',
    description: '更多空间，更多战利品！',
  },
];

// 基础价值范围
export const BASE_VALUE_RANGES: Record<Quality, [number, number]> = {
  white: [50, 150],
  blue: [150, 400],
  purple: [400, 1000],
  red: [1000, 3000],
  gold: [3000, 8000],
};

// 保底机制
export const PITY_SYSTEM = {
  failStreakBonus: 3,      // 连续失败3局，下局开红概率+10%
  failBonusRate: 0.1,
  noDropStreakPity: 5,     // 连续未开红5局，必出红
};

// 爽感描述库（强化版）
export const COOL_DESCRIPTIONS: Record<Quality, string[]> = {
  white: ['看起来很普通', '随处可见的装备'],
  blue: ['品质不错', '值得保留'],
  purple: ['罕见的战利品！', '紫色光芒闪烁', '稀有装备，价值不菲！'],
  red: [
    '🔥 史诗级装备！血红色的光芒令人窒息！',
    '💥 你开红了！这把装备价值连城！',
    '⚡ 史诗品质！市场要炸了！',
    '🎯 极品红装！这一波赚翻了！',
  ],
  gold: [
    '🌟 传说级神器！金色光芒照亮了整个区域！',
    '💰 天哪！你爆出了金色传说！',
    '👑 金色神装！这把可以下线了！',
    '✨ 传说降临！全服玩家都羡慕疯了！',
    '🏆 你是欧皇！金色装备到手！',
  ],
};

// 开红爆发文案（红/金装备专用）
export const RED_DROP_ANNOUNCEMENTS = {
  self: {
    red: [
      '！！！爆了！！！你开红了！！！',
      '这一局的运气被你打穿了！',
      '红装到手！市场正在震动！',
      '终于来了！这把就是你的翻身仗！',
    ],
    gold: [
      '！！！金色传说！！！你真的爆了！！！',
      '全服都在看！你打出了神级装备！',
      '这就是传说中的欧皇时刻！',
      '你做到了！这把可以直接封神！',
    ],
  },
  broadcast: {
    red: [
      '🔥 玩家「{name}」在{zone}爆出红装！市场震动！',
      '💥 有人开红了！「{name}」拿下史诗装备！',
      '⚡ {zone}传来捷报！「{name}」爆出红装！',
    ],
    gold: [
      '🌟！！！全服震撼！！！玩家「{name}」爆出金色传说！',
      '💰 「{name}」在{zone}打出神装！市场沸腾！',
      '👑 欧皇降临！「{name}」获得金色装备！',
    ],
  },
  identity: [
    '👉 你就是这一局的欧皇！',
    '👉 所有人都会记住这次开红！',
    '👉 你的运气已经突破天际！',
    '👉 这一刻，你是全服的焦点！',
  ],
};

// 情绪操控文案
export const EMOTIONAL_MANIPULATION = {
  // 连续失败
  failStreak: {
    2: '👉 战术调整中...通常这种时候要转运了',
    3: '👉 系统似乎在补偿你...下一回合很关键',
    4: '👉 坚持住！红装就在下一个区域等你！',
    5: '👉 你已进入开红边缘状态！下一回合必出！',
  },
  // 连续成功
  winStreak: {
    2: '👉 你的战术状态火热！',
    3: '👉 现在撤离可能错过大红！',
    4: '👉 你是无敌的！继续推进！',
    5: '👉 传说级表现！这一局注定辉煌！',
  },
  // 高收益未撤
  highValueNoExtract: {
    3000: '👉 你已经积累了{value}战利品...真的要收手吗？',
    5000: '👉 {value}在手！再深入一次可能直接翻倍！',
    8000: '👉 {value}！这波可以撤离了...或者再赌一把？',
    12000: '👉 {value}！你现在是战神！还敢继续吗？',
  },
};

// 撤离心理博弈文案
export const EXTRACT_PSYCHOLOGY = {
  conservative: [
    '👉 立即撤离，稳稳带走收益',
    '👉 落袋为安，这是明智的选择',
    '👉 安全撤离，下次再来',
  ],
  greedy: [
    '👉 再深入一次Boss区，可能直接开红！',
    '👉 这一局战术如此顺利，现在走真的不亏吗？',
    '👉 再赌一把！可能就是翻倍！',
    '👉 你的运气还在上升期！现在撤太可惜了！',
    '👉 真正的战士从不犹豫！继续推进！',
  ],
};

// 分享文案模板
export const SHARE_TEMPLATES = {
  redDrop: [
    '我刚刚开红了！！爆了{value}价值装备！\n差点心跳都停了…\n你敢来赌一把吗？',
    '欧皇附体！{value}红装到手！\n这一局我赌赢了！\n你也来试试手气？',
  ],
  goldDrop: [
    '🌟！！！金色传说！！！\n{value}神装爆出！\n我可能是全服最欧的人了！\n不服来战！',
  ],
  highProfit: [
    '单局狂赚{value}！\n差点就死在里面了…\n赌狗的快乐你们不懂！',
  ],
};

// 排行榜动态提示
export const LEADERBOARD_TIPS = {
  nearTop3: '👉 再来一局就能冲进前3！',
  nearTop1: '👉 你已经接近榜单顶端了！',
  overtaken: '👉 你刚刚被人反超了…',
  topPlayer: '👉 你是目前的榜首！保持住！',
};

// 语言风格词库
export const STYLE_VOCABULARY = {
  gambling: ['赌一把', '梭哈', '搏一搏', '单车变摩托'],
  luck: ['欧皇', '运气爆炸', '天选之人', '命中注定'],
  profit: ['血赚', '大赚', '翻倍', '发财了'],
  loss: ['血亏', '白给', '遗憾', '再来一局'],
  encouragement: ['再来一把就出红', '下一把肯定爆', '坚持就是胜利'],
};
