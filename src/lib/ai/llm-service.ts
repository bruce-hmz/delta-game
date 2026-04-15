// AI LLM 服务 - 使用内置 coze-coding-dev-sdk

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  AIEventInput, 
  AIEventOutput, 
  AITacticalInput, 
  AITacticalOutput, 
  AIBattleReportInput, 
  AIBattleReportOutput,
  PlayerMemoryInput,
  PlayerMemoryOutput
} from './types';
import { promptTemplates } from './prompts';
import { logAICall, generateCallId } from '../game/telemetry-service';

// 简单的内存缓存
const cache = new Map<string, { data: any; expireAt: number }>();

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (item && item.expireAt > Date.now()) {
    return item.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttlMs: number): void {
  cache.set(key, { data, expireAt: Date.now() + ttlMs });
  // 清理过期缓存
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.expireAt < now) cache.delete(k);
    }
  }
}

// 生成缓存键
function generateCacheKey(type: string, data: any): string {
  return `${type}:${JSON.stringify(data)}`;
}

// 安全的 JSON 解析
function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    // 尝试提取 JSON 块
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// 调用 LLM 的通用方法 - 使用内置 SDK
async function callLLM(
  systemPrompt: string, 
  userPrompt: string,
  customHeaders?: Record<string, string>
): Promise<string> {
  try {
    const config = new Config();
    const client = new LLMClient(config, customHeaders);
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ];
    
    const response = await client.invoke(messages, { 
      temperature: 0.8,
      model: 'doubao-seed-1-6-lite-251015' // 使用轻量模型，速度快成本低
    });
    
    return response.content || '';
  } catch (error) {
    console.error('LLM call failed:', error);
    throw error;
  }
}

// ==================== 事件生成 ====================

// 预设事件模板（兜底）
const fallbackEvents: Record<string, AIEventOutput[]> = {
  normal: [
    {
      title: '废弃房屋',
      description: '你小心翼翼地推开废弃房屋的门，在昏暗的房间里搜寻有价值的物资。',
      eventType: 'discovery',
      tensionLevel: 2
    },
    {
      title: '物资箱',
      description: '你发现路边有一个生锈的物资箱，打开后发现了一些有用的装备。',
      eventType: 'discovery',
      tensionLevel: 1
    }
  ],
  dangerous: [
    {
      title: '军械库',
      description: '你潜入了被撬开的小型军械库，在紧张的氛围中快速搜索高价值装备。',
      eventType: 'treasure',
      tensionLevel: 3
    },
    {
      title: '巡逻队',
      description: '你发现了一队武装人员正在巡逻，迅速找到掩体躲避，等待机会继续前进。',
      eventType: 'encounter',
      tensionLevel: 4
    }
  ],
  boss: [
    {
      title: '核心实验室',
      description: '你找到了核心实验室入口，里面闪烁着诡异的蓝光，你决定冒险进入。',
      eventType: 'treasure',
      tensionLevel: 5
    },
    {
      title: '精英守卫',
      description: '一名全副武装的精英守卫挡住了去路，你判断局势后选择了一条更隐蔽的路线。',
      eventType: 'encounter',
      tensionLevel: 5
    }
  ]
};

export async function generateEvent(
  input: AIEventInput, 
  customHeaders?: Record<string, string>,
  playerInfo?: { id?: string; name?: string }
): Promise<AIEventOutput> {
  const callId = generateCallId();
  const startTime = Date.now();
  const cacheKey = generateCacheKey('event', { zone: input.zone, style: input.playerStyle, round: input.round });
  const cached = getCached<AIEventOutput>(cacheKey);
  if (cached) {
    await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'event', context: input, success: true, responseTimeMs: 0, tokensUsed: 0, cacheHit: true, model: 'doubao' });
    return cached;
  }

  try {
    const systemPrompt = promptTemplates.eventSystem;
    const userPrompt = promptTemplates.eventUser(input);
    
    const response = await callLLM(systemPrompt, userPrompt, customHeaders);
    const event = safeJsonParse<AIEventOutput | null>(response, null);
    
    // 只验证标题和描述，不再要求choices
    if (event && event.title && event.description) {
      // 验证并修正事件类型
      if (!['discovery', 'encounter', 'trap', 'npc', 'ambush', 'treasure'].includes(event.eventType)) {
        event.eventType = 'discovery';
      }
      setCache(cacheKey, event, 60000); // 缓存1分钟
      await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'event', context: input, success: true, responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
      return event;
    }
    
    throw new Error('Invalid event structure');
  } catch (error) {
    console.error('Event generation failed, using fallback:', error);
    await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'event', context: input, success: false, errorMessage: error instanceof Error ? error.message : 'Unknown', responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
    // 使用预设模板
    const zoneEvents = fallbackEvents[input.zone] || fallbackEvents.normal;
    const randomEvent = zoneEvents[Math.floor(Math.random() * zoneEvents.length)];
    return randomEvent;
  }
}

// ==================== 战术建议 ====================

export async function generateTacticalAdvice(
  input: AITacticalInput, 
  customHeaders?: Record<string, string>,
  playerInfo?: { id?: string; name?: string }
): Promise<AITacticalOutput> {
  const callId = generateCallId();
  const startTime = Date.now();
  const cacheKey = generateCacheKey('advice', { 
    zone: input.zone, 
    carryValue: input.carryValue, 
    style: input.playerStyle 
  });
  const cached = getCached<AITacticalOutput>(cacheKey);
  if (cached) {
    await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'advice', context: input, success: true, responseTimeMs: 0, tokensUsed: 0, cacheHit: true, model: 'doubao' });
    return cached;
  }

  try {
    const systemPrompt = promptTemplates.adviceSystem;
    const userPrompt = promptTemplates.adviceUser(input);
    
    const response = await callLLM(systemPrompt, userPrompt, customHeaders);
    const advice = safeJsonParse<AITacticalOutput | null>(response, null);
    
    if (advice && advice.advice && advice.recommendation) {
      // 验证 recommendation
      if (!['explore', 'extract'].includes(advice.recommendation.action)) {
        advice.recommendation.action = input.carryValue > 5000 ? 'extract' : 'explore';
      }
      advice.recommendation.confidence = Math.max(0, Math.min(1, advice.recommendation.confidence || 0.5));
      setCache(cacheKey, advice, 300000); // 缓存5分钟
      await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'advice', context: input, success: true, responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
      return advice;
    }
    
    throw new Error('Invalid advice structure');
  } catch (error) {
    console.error('Advice generation failed, using fallback:', error);
    await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'advice', context: input, success: false, errorMessage: error instanceof Error ? error.message : 'Unknown', responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
    return getFallbackAdvice(input);
  }
}

function getFallbackAdvice(input: AITacticalInput): AITacticalOutput {
  const { carryValue, playerStyle, round } = input;
  
  let action: 'explore' | 'extract' = 'explore';
  let confidence = 0.5;
  let reason = '';
  let advice = '';
  
  if (carryValue === 0 && round === 1) {
    action = 'explore';
    confidence = 0.8;
    reason = '开局阶段，需要积累物资';
    advice = '🎯 首要目标：探索低风险区获取物资。建议从废弃居民区开始。';
  } else if (carryValue < 2000) {
    action = 'explore';
    confidence = 0.6;
    reason = '当前收益较低，可继续探索';
    advice = '✅ 当前风险可控，可以继续探索积累更多物资。';
  } else if (carryValue < 5000) {
    action = playerStyle === 'aggressive' ? 'explore' : 'extract';
    confidence = 0.6;
    reason = playerStyle === 'aggressive' ? '激进风格适合继续探索' : '稳健风格建议落袋为安';
    advice = playerStyle === 'aggressive' 
      ? '🔥 携带价值不错，你的风格适合继续深入高风险区。'
      : '⚠️ 携带价值较高，建议考虑撤离变现。';
  } else if (carryValue < 10000) {
    action = 'extract';
    confidence = 0.7;
    reason = '高价值目标，建议撤离';
    advice = '🔥 高价值目标！贪婪可能导致全损，强烈建议撤离。';
  } else {
    action = 'extract';
    confidence = 0.9;
    reason = '极高价值，必须撤离';
    advice = '💀 极高价值！一次失败将损失惨重，立即撤离！';
  }
  
  return {
    advice,
    recommendation: { action, confidence, reason },
    personality: playerStyle === 'aggressive' ? 'encouraging' : 'cautious'
  };
}

// ==================== 战报生成 ====================

export async function generateBattleReport(
  input: AIBattleReportInput, 
  customHeaders?: Record<string, string>,
  playerInfo?: { id?: string; name?: string }
): Promise<AIBattleReportOutput> {
  const callId = generateCallId();
  const startTime = Date.now();
  try {
    const systemPrompt = promptTemplates.reportSystem;
    const userPrompt = promptTemplates.reportUser(input);
    
    const response = await callLLM(systemPrompt, userPrompt, customHeaders);
    const report = safeJsonParse<AIBattleReportOutput | null>(response, null);
    
    if (report && report.title && report.narrative) {
      await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'report', context: input, success: true, responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
      return report;
    }
    
    throw new Error('Invalid report structure');
  } catch (error) {
    console.error('Report generation failed, using fallback:', error);
    await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'report', context: input, success: false, errorMessage: error instanceof Error ? error.message : 'Unknown', responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
    return getFallbackReport(input);
  }
}

function getFallbackReport(input: AIBattleReportInput): AIBattleReportOutput {
  const { result, events, playerStyle, totalRounds, zonesExplored } = input;
  
  const title = result.success ? '成功撤离' : '任务失败';
  
  // 简单叙事
  let narrative = `你在${zonesExplored.join('、')}进行了${totalRounds}回合的探索。\n\n`;
  
  if (result.success) {
    narrative += `最终成功撤离，带走了价值 ${result.finalValue.toLocaleString()} 的装备。`;
  } else {
    narrative += `遗憾的是，你在探索中遭遇了意外${result.deathCause ? `：${result.deathCause}` : ''}。`;
    if (result.lostValue) {
      narrative += `损失了价值 ${result.lostValue.toLocaleString()} 的装备。`;
    }
  }
  
  // 提取高光时刻
  const highlights = events
    .filter(e => Math.abs(e.valueChange) > 1000)
    .slice(0, 3)
    .map(e => ({
      round: e.round,
      type: e.valueChange > 0 ? 'big_find' as const : 'close_call' as const,
      description: e.eventTitle
    }));
  
  // 参谋点评
  const advisorComment = result.success
    ? playerStyle === 'aggressive'
      ? '你今天的风格很激进，但成功了。继续保持这种魄力！'
      : '稳健的决策带来了稳定的收益，继续保持。'
    : '失败是成功的一部分。总结经验，下次会更好。';
  
  return {
    title,
    narrative,
    highlights,
    advisorComment
  };
}

// ==================== 玩家记忆摘要 ====================

export async function generateMemorySummary(
  input: PlayerMemoryInput,
  playerInfo?: { id?: string; name?: string }
): Promise<PlayerMemoryOutput> {
  const callId = generateCallId();
  const startTime = Date.now();
  try {
    const systemPrompt = promptTemplates.memorySystem;
    const userPrompt = promptTemplates.memoryUser(input);
    
    const response = await callLLM(systemPrompt, userPrompt);
    const memory = safeJsonParse<PlayerMemoryOutput | null>(response, null);
    
    if (memory && memory.summaryForAI) {
      await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'memory', context: input, success: true, responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
      return memory;
    }
    
    throw new Error('Invalid memory structure');
  } catch (error) {
    console.error('Memory generation failed, using fallback:', error);
    await logAICall({ callId, playerId: playerInfo?.id, playerName: playerInfo?.name, callType: 'memory', context: input, success: false, errorMessage: error instanceof Error ? error.message : 'Unknown', responseTimeMs: Date.now() - startTime, tokensUsed: 0, cacheHit: false, model: 'doubao' });
    return getFallbackMemory(input);
  }
}

function getFallbackMemory(input: PlayerMemoryInput): PlayerMemoryOutput {
  const { styleTag, totalGames, maxProfit, recentHighlights } = input;
  
  const summaryForAI = `${styleTag === 'aggressive' ? '激进' : styleTag === 'conservative' ? '保守' : '均衡'}型玩家，已完成${totalGames}局游戏，最高单局收益${maxProfit.toLocaleString()}`;
  
  const keyMemories = recentHighlights.slice(0, 3);
  if (maxProfit > 10000) {
    keyMemories.unshift(`最高收益 ${maxProfit.toLocaleString()}`);
  }
  
  return {
    summaryForAI,
    keyMemories,
    personalityTraits: [styleTag]
  };
}

// ==================== 导出 ====================

export const aiService = {
  generateEvent,
  generateTacticalAdvice,
  generateBattleReport,
  generateMemorySummary,
};
