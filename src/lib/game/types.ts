// 游戏核心类型定义

// 导入 AI 相关类型
import type { AIEventOutput, AIBattleReportOutput } from '@/lib/ai/types';

// 常量定义
export const EQUIPMENT_SLOTS = 10;    // 装备槽上限
export const BACKPACK_SIZE = 5;        // 背包容量
export const SAFEBOX_SIZE = 10;        // 保险箱容量
export const MAX_DEATH_REDUCTION = 0.5; // 死亡概率降低上限 50%
export const MAX_RED_DROP_BOOST = 0.3;  // 红装掉率提升上限 30%
export const MAX_EXTRACT_BOOST = 0.5;   // 撤离成功率提升上限 50%

// 装备品质
export type Quality = 'white' | 'blue' | 'purple' | 'red' | 'gold';

// 装备词条类型
export type AffixType = 
  | 'value_bonus'        // 价值加成
  | 'extract_rate'       // 撤离成功率
  | 'combat_rate'        // 战斗胜率
  | 'bag_size'           // 背包容量
  | 'drop_rate'          // 开红概率
  | 'death_protection';  // 死亡保护

// 装备词条
export interface Affix {
  type: AffixType;
  value: number;
  description: string;
}

// 装备
export interface Equipment {
  id: string;
  name: string;
  quality: Quality;
  affixes: Affix[];
  baseValue: number;
  totalValue: number;
  description: string;
}

// 背包物品（可以是装备或资源）
export interface InventoryItem {
  type: 'equipment' | 'resource';
  item: Equipment | { name: string; value: number };
}

// 玩家风格标签
export type PlayerStyleTag = 'aggressive' | 'conservative' | 'balanced' | 'unknown';

// 玩家状态
export interface PlayerState {
  id: string;
  name: string;
  money: number;                    // 资金
  bind_email?: string | null;       // 绑定邮箱
  google_id?: string | null;        // Google 账号 ID
  google_email?: string | null;     // Google 邮箱
  equipmentSlots?: InventoryItem[]; // 装备槽（10格）
  inventory: InventoryItem[];       // 背包（5格）
  safeBox?: InventoryItem[];        // 保险箱（10格）
  currentRound: number;             // 当前回合
  totalExtractValue: number;        // 本局总收益
  failStreak: number;               // 连续失败次数
  winStreak: number;                // 连续成功次数
  noDropStreak: number;             // 连续未开红次数
  bonusDropRate: number;            // 额外开红概率
  combatWinRateBonus: number;       // 额外战斗胜率
  extractRateBonus: number;         // 额外撤离率
  isAlive: boolean;                 // 是否存活
  // 扩展属性
  currentHp?: number;               // 当前血量
  maxHp?: number;                   // 最大血量
  currentZone?: string;             // 当前区域
  killCount?: number;               // 击杀数
  redDropCount?: number;            // 开红次数（总）
  maxProfit?: number;               // 单局最高收益
  totalGames?: number;              // 总游戏次数
  lastLogin?: string | null;        // 最后登录时间
  items?: PlayerItem[];             // 玩家道具（商店购买的道具）
  // AI 相关属性
  styleTag?: PlayerStyleTag;        // 玩家风格标签
  styleScore?: {                    // 风格分数
    riskTaking: number;             // 冒险倾向 0-100
    patience: number;               // 耐心程度 0-100
    efficiency: number;             // 效率导向 0-100
  };
  recentHighlights?: string[];      // 最近高光时刻
  successfulExtracts?: number;      // 成功撤离次数
  firstGame?: boolean;              // 是否首局
  // 信任度系统
  trustLevel?: number;              // 信任度等级 1-5
  trustScore?: number;              // 信任度分数 0-100
  aiAdviceAccepted?: number;        // AI 建议被采纳次数
  aiAdviceTotal?: number;          // AI 建议总数
  riskStars?: number;               // 风险星级 1-5
  // 行动分叉系统
  exposure?: number;                // 暴露度 0-10
  loadLevel?: LoadLevel;            // 负重等级
}

// 玩家道具
export interface PlayerItem {
  type: string;
  name: string;
  quantity: number;
  effect?: any;
  isEquipped?: boolean;
}

// ==================== 行动与状态系统 ====================

// 行动类型
export type ActionType = 'stealth' | 'search' | 'assault';

// 负重等级
export type LoadLevel = 'light' | 'normal' | 'heavy' | 'overloaded';

// 事件类型
export type EventCategory = 'resource' | 'encounter' | 'trap' | 'combat' | 'movement' | 'escape';

// 事件选项
export interface EventOption {
  id: string;
  text: string;                    // 选项显示文本
  action: string;                  // 行动描述
  exposureChange: number;          // 暴露度变化
  loadChange: 'increase' | 'decrease' | 'none'; // 负重变化方向
  loadPercent?: number;            // 负重变化百分比
  successRate: number;             // 成功率 0-100
  rewardChange: number;            // 收益变化 -100 to +100（百分比）
  riskLevel: 'low' | 'medium' | 'high'; // 风险等级
}

// 事件结果
export interface EventResult {
  success: boolean;                // 是否成功
  message: string;                // 结果描述
  loot?: Equipment;                // 获得的装备
  exposureChange: number;          // 实际暴露度变化
  loadChange: number;              // 实际负重变化（价值）
  rewardChange: number;            // 实际收益变化（百分比）
  isRedDrop?: boolean;             // 是否开红
  broadcast?: string;              // 全服播报
  isDeath?: boolean;               // 是否死亡
  deathResult?: DeathResult;       // 死亡结果
}

// 事件模板
export interface EventTemplate {
  id: string;
  name: string;                    // 事件名称
  zone: 'normal' | 'dangerous' | 'boss' | 'any'; // 区域
  category: EventCategory;         // 事件类别
  triggerExposure: { min: number; max: number }; // 触发暴露度范围
  description: string;             // 事件描述
  options: EventOption[];          // 选项列表
  recommendExtract: boolean;       // 是否建议撤离
  aiAdvice: string;                // AI建议
  reportLine: string;              // 战报记录句子模板
  weight: number;                  // 事件权重
}

// 扩展 PlayerState
export interface ExtendedPlayerState extends PlayerState {
  exposure: number;                // 暴露度 0-10
  currentAction?: ActionType;       // 当前行动类型
  loadLevel: LoadLevel;            // 负重等级
  currentEvent?: EventTemplate;     // 当前事件模板
}

// ==================== 原有的探索结果扩展 ====================

// 区域类型
export type ZoneType = 'normal' | 'dangerous' | 'boss';

// 战斗结果
export interface CombatResult {
  success: boolean;
  reward?: Equipment;
  message: string;
}

// 死亡/撤离失败结果
export interface DeathResult {
  deathProtectionTriggered: boolean;  // 死亡保护是否触发
  equipmentLost: string[];            // 装备槽丢失物品
  equipmentKept: string[];            // 装备槽保留物品
  backpackLost: string[];             // 背包丢失物品
  backpackKept: string[];             // 背包保留物品
  droppedItems: string[];             // 本次掉落物品
  moneyBefore: number;                // 资产扣除前
  moneyAfter: number;                 // 资产扣除后
  moneyLost: number;                  // 资产损失量
}

// 探索结果
export interface ExploreResult {
  success: boolean;
  loot?: Equipment;
  combat?: CombatResult;
  isRedDrop: boolean;
  message: string;
  broadcast?: string;              // 全局播报消息
  redDropAnnouncement?: {          // 开红爆发文案
    selfMessages: string[];
    identityMessage: string;
  };
  emotionalTip?: string;           // 情绪诱导文案
  shareText?: string;              // 分享文案
  needChoice?: boolean;            // 是否需要玩家选择
  choices?: ItemChoice[];          // 可选项
  pendingItem?: Equipment;         // 待选择的物品
  deathResult?: DeathResult;       // 死亡结果
  aiEvent?: AIEventOutput;         // AI 生成的事件
  // 事件选择分支
  needEventChoice?: boolean;        // 是否需要事件选择
  eventChoiceType?: EventChoiceType; // 事件选择类型
  eventChoices?: EventChoice[];     // 事件选项
  eventContext?: string;           // 事件上下文描述
}

// 事件选择分支
export interface EventChoice {
  id: string;                       // 选项 ID
  text: string;                     // 选项描述
  riskHint: string;                 // 风险提示
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  rewardHint?: string;              // 奖励提示
}

// 事件选择类型
export type EventChoiceType = 
  | 'combat'         // 战斗选择：硬刚/潜行/撤退
  | 'trade'          // 交易选择：买/卖/拒绝
  | 'discovery'      // 发现选择：探索/绕过/标记
  | 'npc'            // NPC 选择：帮助/利用/忽视
  | 'trap'           // 陷阱选择：触发/拆除/规避
  | 'treasure';      // 宝藏选择：立即获取/谨慎检查/放弃

// 物品选择
export interface ItemChoice {
  id: string;
  label: string;
  description: string;
}

// 撤离结果
export interface ExtractResult {
  success: boolean;
  totalValue: number;
  message: string;
  deathResult?: DeathResult;       // 撤离失败结果
  aiReport?: AIBattleReportOutput; // AI 生成的战报
}

// 排行榜条目
export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  value: number;
  timestamp: number;
}

// 排行榜数据
export interface Leaderboard {
  wealth: LeaderboardEntry[];      // 财富榜
  redDrops: LeaderboardEntry[];    // 开红次数榜
  maxProfit: LeaderboardEntry[];   // 单局最高收益榜
}

// 游戏事件
export interface GameEvent {
  type: 'drop' | 'combat' | 'extract' | 'death';
  message: string;
  timestamp: number;
  isRed?: boolean;
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 游戏状态响应
export interface GameStateResponse {
  player: PlayerState;
  events: GameEvent[];
  leaderboard: Leaderboard;
}

// 排行榜响应
export interface LeaderboardResponse {
  leaderboard: Leaderboard;
  playerRank?: {
    wealth: number;
    redDrops: number;
    maxProfit: number;
  };
}
