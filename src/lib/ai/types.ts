// AI 服务类型定义

// ==================== 事件生成 ====================

export interface AIEventInput {
  zone: 'normal' | 'dangerous' | 'boss';
  zoneName: string;
  carryValue: number;
  round: number;
  playerStyle: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  recentEvents: string[]; // 最近事件标题，避免重复
}

export interface AIEventChoice {
  id: string;
  text: string;
  riskHint: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AIEventOutput {
  title: string;
  description: string;
  choices?: AIEventChoice[];  // 改为可选，不再强制要求
  eventType: 'discovery' | 'encounter' | 'trap' | 'npc' | 'ambush' | 'treasure';
  tensionLevel: 1 | 2 | 3 | 4 | 5;
}

// ==================== 战术建议 ====================

export interface AITacticalInput {
  zone: 'normal' | 'dangerous' | 'boss';
  zoneName: string;
  carryValue: number;
  round: number;
  playerStyle: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  buffs: {
    deathRateReduction: number;
    redDropBoost: number;
    extractBoost: number;
    combatBoost: number;
  };
  recentPerformance: {
    winStreak: number;
    failStreak: number;
    recentDeathRate: number;
  };
  historyHighlights: string[];
  // S5: AI 引用历史建议
  historyAdviceSummary?: string;
}

export interface AITacticalOutput {
  advice: string;
  recommendation: {
    action: 'explore' | 'extract';
    confidence: number; // 0-1
    reason: string;
  };
  personality: 'cautious' | 'encouraging' | 'analytical'; // 参谋性格
}

// ==================== 战报生成 ====================

export interface AIBattleReportInput {
  result: {
    success: boolean;
    finalValue: number;
    lostValue?: number;
    deathCause?: string;
  };
  events: Array<{
    round: number;
    zone: string;
    eventTitle: string;
    outcome: string;
    valueChange: number;
  }>;
  playerStyle: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  playerName: string;
  totalRounds: number;
  zonesExplored: string[];
  highlights: string[];
}

export interface AIBattleReportOutput {
  title: string;
  narrative: string;
  highlights: Array<{
    round: number;
    type: 'big_find' | 'close_call' | 'smart_choice' | 'red_drop';
    description: string;
  }>;
  advisorComment: string;
}

// ==================== 玩家记忆 ====================

export interface PlayerMemoryInput {
  styleTag: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  totalGames: number;
  successfulExtracts: number;
  deathCount: number;
  redDropCount: number;
  maxProfit: number;
  recentHighlights: string[];
  recentRuns: Array<{
    success: boolean;
    value: number;
    style: string;
  }>;
}

export interface PlayerMemoryOutput {
  summaryForAI: string;
  keyMemories: string[];
  personalityTraits: string[];
}

// ==================== AI 服务状态 ====================

export interface AIServiceStatus {
  available: boolean;
  model: string;
  lastCallTime: number;
  errorCount: number;
}

// ==================== 缓存键 ====================

export interface AICacheKey {
  type: 'event' | 'advice' | 'report';
  hash: string;
}

// ==================== 战报分享 ====================

export interface ShareReport {
  id: string;                      // 分享ID
  playerName: string;              // 玩家名称
  result: 'success' | 'fail';      // 撤离结果
  finalValue: number;              // 最终收益
  totalRounds: number;             // 总回合数
  aiReport: {
    title: string;                 // AI战报标题
    narrative: string;             // AI战报叙事
    highlights: Array<{            // 高光时刻
      round: number;
      type: string;
      description: string;
    }>;
    advisorComment: string;        // 参谋评价
  };
  playerStyle: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  zonesExplored: string[];         // 探索的区域
  timestamp: number;               // 时间戳
}

export interface ShareReportInput {
  playerName: string;
  result: 'success' | 'fail';
  finalValue: number;
  totalRounds: number;
  aiReport: ShareReport['aiReport'];
  playerStyle: ShareReport['playerStyle'];
  zonesExplored: string[];
}
