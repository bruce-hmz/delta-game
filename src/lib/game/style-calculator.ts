// 玩家风格计算工具

import { PlayerState, PlayerStyleTag } from './types';

// 风格计算配置
const STYLE_CONFIG = {
  // 冒险倾向计算
  riskTaking: {
    highRiskZoneWeight: 0.4,     // 高风险区域探索权重
    lowExtractThreshold: 0.3,    // 低撤离阈值（携带价值）
    highValueStay: 0.3,          // 高价值继续探索权重
  },
  // 耐心程度计算
  patience: {
    earlyExtract: 0.3,           // 早期撤离权重
    roundAverage: 0.4,           // 平均回合数权重
    streakRecovery: 0.3,         // 连败后恢复权重
  },
  // 效率导向计算
  efficiency: {
    profitPerRound: 0.5,         // 每回合收益权重
    extractSuccessRate: 0.3,     // 撤离成功率权重
    deathRate: 0.2,              // 死亡率权重
  },
};

// 计算玩家风格标签
export function calculatePlayerStyle(player: PlayerState): PlayerStyleTag {
  if (!player.totalGames || player.totalGames < 3) {
    return 'unknown';
  }

  const scores = calculateStyleScore(player);
  
  // 根据分数判断风格
  if (scores.riskTaking >= 65 && scores.patience < 40) {
    return 'aggressive';
  } else if (scores.riskTaking < 35 && scores.patience >= 60) {
    return 'conservative';
  } else {
    return 'balanced';
  }
}

// 计算风格分数
export function calculateStyleScore(player: PlayerState): {
  riskTaking: number;
  patience: number;
  efficiency: number;
} {
  // 默认值
  const defaultScore = { riskTaking: 50, patience: 50, efficiency: 50 };
  
  if (!player.totalGames || player.totalGames < 1) {
    return defaultScore;
  }

  // 计算冒险倾向（基于死亡率、开红次数）
  let riskTaking = 50;
  
  // 死亡率越高，冒险倾向越高
  if (player.totalGames > 0) {
    const deathRate = (player.failStreak || 0) / Math.max(player.totalGames, 1);
    riskTaking = Math.min(100, 30 + deathRate * 100 + (player.redDropCount || 0) * 5);
  }
  
  // 计算耐心程度（基于撤离成功率）
  let patience = 50;
  
  if (player.totalGames > 0 && player.successfulExtracts) {
    const extractRate = player.successfulExtracts / player.totalGames;
    patience = Math.round(30 + extractRate * 70);
  }
  
  // 计算效率导向（基于平均收益）
  let efficiency = 50;
  
  if (player.totalGames > 0 && player.maxProfit) {
    // 以 5000 为基准线
    efficiency = Math.min(100, Math.round(40 + (player.maxProfit / 5000) * 30));
  }

  return {
    riskTaking: Math.round(riskTaking),
    patience: Math.round(patience),
    efficiency: Math.round(efficiency),
  };
}

// 获取风格描述
export function getStyleDescription(style: PlayerStyleTag): string {
  const descriptions: Record<PlayerStyleTag, string> = {
    aggressive: '🔥 激进型',
    conservative: '🛡️ 保守型',
    balanced: '⚖️ 均衡型',
    unknown: '❓ 待评估',
  };
  
  return descriptions[style];
}

// 获取风格详细描述
export function getStyleDetail(style: PlayerStyleTag): string {
  const details: Record<PlayerStyleTag, string> = {
    aggressive: '你喜欢高风险高回报，敢于深入危险区域追求极品装备。',
    conservative: '你倾向于稳扎稳打，优先保证安全撤离。',
    balanced: '你懂得权衡风险与收益，根据情况灵活调整策略。',
    unknown: '完成更多对局后，系统将为你分析战术风格。',
  };
  
  return details[style];
}

// 生成玩家记忆摘要（供 AI 引用）
export function generatePlayerMemorySummary(player: PlayerState): string {
  const style = player.styleTag || calculatePlayerStyle(player);
  const styleDesc = getStyleDescription(style);
  
  const parts: string[] = [];
  
  parts.push(`${styleDesc}玩家`);
  
  if (player.totalGames && player.totalGames > 0) {
    parts.push(`已完成${player.totalGames}局`);
  }
  
  if (player.successfulExtracts && player.successfulExtracts > 0) {
    parts.push(`成功撤离${player.successfulExtracts}次`);
  }
  
  if (player.redDropCount && player.redDropCount > 0) {
    parts.push(`开红${player.redDropCount}次`);
  }
  
  if (player.maxProfit && player.maxProfit > 0) {
    parts.push(`最高收益${player.maxProfit.toLocaleString()}`);
  }
  
  return parts.join('，');
}

// 更新玩家风格标签
export function updatePlayerStyle(player: PlayerState): PlayerState {
  const styleTag = calculatePlayerStyle(player);
  const styleScore = calculateStyleScore(player);
  
  return {
    ...player,
    styleTag,
    styleScore,
  };
}

// 判断是否是高价值时刻
export function isHighValueMoment(player: PlayerState): boolean {
  const inventoryValue = player.inventory.reduce((sum, item) => {
    if (item.type === 'equipment') {
      return sum + (item.item as any).totalValue;
    }
    return sum + (item.item as any).value;
  }, 0);
  
  const equipmentValue = (player.equipmentSlots || []).reduce((sum, item) => {
    if (item.type === 'equipment') {
      return sum + (item.item as any).totalValue;
    }
    return sum + (item.item as any).value;
  }, 0);
  
  const totalValue = inventoryValue + equipmentValue;
  
  return totalValue >= 5000;
}

// 获取战术建议上下文
export function getTacticalContext(player: PlayerState): {
  style: PlayerStyleTag;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'explore' | 'extract' | 'neutral';
} {
  const style = player.styleTag || 'unknown';
  
  // 计算当前风险等级
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  const totalValue = player.inventory.reduce((sum, item) => {
    if (item.type === 'equipment') return sum + (item.item as any).totalValue;
    return sum + (item.item as any).value;
  }, 0) + (player.equipmentSlots || []).reduce((sum, item) => {
    if (item.type === 'equipment') return sum + (item.item as any).totalValue;
    return sum + (item.item as any).value;
  }, 0);
  
  if (totalValue >= 8000) {
    riskLevel = 'high';
  } else if (totalValue >= 3000) {
    riskLevel = 'medium';
  }
  
  // 生成推荐
  let recommendation: 'explore' | 'extract' | 'neutral' = 'neutral';
  
  if (totalValue >= 5000) {
    recommendation = 'extract';
  } else if (totalValue < 2000 && player.currentRound < 5) {
    recommendation = 'explore';
  }
  
  return {
    style,
    riskLevel,
    recommendation,
  };
}
