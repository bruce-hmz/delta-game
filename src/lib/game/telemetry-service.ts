// AI 埋点统计服务

export type CallType = 'event' | 'advice' | 'report' | 'memory';

export interface AICallLog {
  callId: string;
  playerId?: string;
  playerName?: string;
  callType: CallType;
  context: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  responseTimeMs: number;
  tokensUsed: number;
  cacheHit: boolean;
  model: string;
}

export interface ShareLog {
  playerId?: string;
  playerName?: string;
  shareResult: 'success' | 'fail';
  finalValue: number;
  playerStyle?: string;
}

// 生成唯一调用ID
export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// 脱敏上下文数据（移除敏感信息）
export function sanitizeContext(context: Record<string, any>, callType: CallType): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  // 通用字段
  sanitized.zone = context.zone;
  sanitized.zoneName = context.zoneName;
  sanitized.round = context.round;
  sanitized.playerStyle = context.playerStyle;
  
  // 根据调用类型保留不同字段
  switch (callType) {
    case 'event':
      sanitized.carryValue = context.carryValue;
      sanitized.recentEventsCount = context.recentEvents?.length || 0;
      break;
    case 'advice':
      sanitized.carryValue = context.carryValue;
      sanitized.buffsCount = Object.keys(context.buffs || {}).length;
      sanitized.recentPerformanceCount = Object.keys(context.recentPerformance || {}).length;
      break;
    case 'report':
      sanitized.result = context.result?.success ? 'success' : 'fail';
      sanitized.finalValue = context.result?.finalValue;
      sanitized.totalRounds = context.totalRounds;
      sanitized.eventsCount = context.events?.length || 0;
      sanitized.highlightsCount = context.highlights?.length || 0;
      break;
    case 'memory':
      sanitized.totalGames = context.totalGames;
      sanitized.recentRunsCount = context.recentRuns?.length || 0;
      break;
  }
  
  return sanitized;
}

// 记录 AI 调用
export async function logAICall(callLog: AICallLog): Promise<void> {
  try {
    await fetch('/api/telemetry/ai-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...callLog,
        context: sanitizeContext(callLog.context, callLog.callType),
      }),
    });
  } catch (error) {
    // 埋点失败不影响主流程，静默处理
    console.debug('AI call logging failed:', error);
  }
}

// 记录分享
export async function logShare(shareLog: ShareLog): Promise<void> {
  try {
    await fetch('/api/telemetry/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shareLog),
    });
  } catch (error) {
    console.debug('Share logging failed:', error);
  }
}

// 带埋点的 AI 调用包装器
export async function withTelemetry<T>(
  callType: CallType,
  context: Record<string, any>,
  apiCall: () => Promise<T>,
  player?: { id?: string; name?: string }
): Promise<T> {
  const callId = generateCallId();
  const startTime = Date.now();
  
  try {
    const result = await apiCall();
    const responseTime = Date.now() - startTime;
    
    // 记录成功调用
    await logAICall({
      callId,
      playerId: player?.id,
      playerName: player?.name,
      callType,
      context,
      success: true,
      responseTimeMs: responseTime,
      tokensUsed: 0, // 由具体服务补充
      cacheHit: false,
      model: 'doubao',
    });
    
    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // 记录失败调用
    await logAICall({
      callId,
      playerId: player?.id,
      playerName: player?.name,
      callType,
      context,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      responseTimeMs: responseTime,
      tokensUsed: 0,
      cacheHit: false,
      model: 'doubao',
    });
    
    throw error;
  }
}
