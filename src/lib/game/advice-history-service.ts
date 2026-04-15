// AI 历史建议服务

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// 记录 AI 建议
export async function recordAIAdvice(
  playerId: string,
  data: {
    runId?: string;
    round: number;
    zone: string;
    carryValue: number;
    adviceText: string;
    recommendation: {
      action: string;
      confidence: number;
      reason: string;
    };
    personality: string;
  }
) {
  const db = getSupabase();
  if (!db) return;
  
  const { error } = await db.from('ai_advice_history').insert({
    player_id: playerId,
    run_id: data.runId || null,
    round: data.round,
    zone: data.zone,
    carry_value: data.carryValue,
    advice_text: data.adviceText,
    recommendation: data.recommendation,
    personality: data.personality,
  });
  
  if (error) console.error('Failed to record AI advice:', error);
}

// 更新建议结果
export async function updateAdviceOutcome(
  playerId: string,
  round: number,
  outcome: {
    decision?: 'follow' | 'ignore' | 'opposite';
    result?: string;
    valueChange?: number;
  }
) {
  const db = getSupabase();
  if (!db) return;
  
  // 获取最近一条建议
  const { data: advice, error } = await db
    .from('ai_advice_history')
    .select('id')
    .eq('player_id', playerId)
    .eq('round', round)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !advice) return;
  
  await db
    .from('ai_advice_history')
    .update({
      player_decision: outcome.decision || null,
      outcome: outcome.result || null,
      value_change: outcome.valueChange || 0,
    })
    .eq('id', advice.id);
}

// 获取玩家建议历史（用于 AI 参考）
export async function getAdviceHistory(playerId: string, limit: number = 10) {
  const db = getSupabase();
  if (!db) return [];
  
  const { data, error } = await db
    .from('ai_advice_history')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error || !data) return [];
  
  return data.map(item => ({
    round: item.round,
    zone: item.zone,
    carryValue: item.carry_value,
    advice: item.advice_text,
    recommendation: item.recommendation,
    personality: item.personality,
    decision: item.player_decision,
    outcome: item.outcome,
    valueChange: item.value_change,
    createdAt: item.created_at,
  }));
}

// 获取建议采纳率统计
export async function getAdviceStats(playerId: string) {
  const db = getSupabase();
  if (!db) return { total: 0, followed: 0, ignored: 0, opposite: 0, followRate: 0, avgFollowValue: 0, avgIgnoreValue: 0 };
  
  const { data, error } = await db
    .from('ai_advice_history')
    .select('player_decision, recommendation, value_change')
    .eq('player_id', playerId)
    .not('player_decision', 'is', null);
  
  if (error || !data) return { total: 0, followed: 0, ignored: 0, opposite: 0, followRate: 0, avgFollowValue: 0, avgIgnoreValue: 0 };
  
  const total = data.length;
  const followed = data.filter(d => d.player_decision === 'follow').length;
  const ignored = data.filter(d => d.player_decision === 'ignore').length;
  const opposite = data.filter(d => d.player_decision === 'opposite').length;
  
  // 采纳后的收益
  const followResults = data.filter(d => d.player_decision === 'follow');
  const ignoreResults = data.filter(d => d.player_decision === 'ignore');
  
  const avgFollowValue = followResults.length > 0
    ? followResults.reduce((sum, d) => sum + (d.value_change || 0), 0) / followResults.length
    : 0;
  
  const avgIgnoreValue = ignoreResults.length > 0
    ? ignoreResults.reduce((sum, d) => sum + (d.value_change || 0), 0) / ignoreResults.length
    : 0;
  
  return {
    total,
    followed,
    ignored,
    opposite,
    followRate: total > 0 ? Math.round((followed / total) * 100) : 0,
    avgFollowValue: Math.round(avgFollowValue),
    avgIgnoreValue: Math.round(avgIgnoreValue),
  };
}

// 生成建议历史摘要（用于 AI 上下文）
export async function generateHistorySummary(playerId: string): Promise<string> {
  const history = await getAdviceHistory(playerId, 5);
  
  if (!history || history.length === 0) {
    return '暂无历史建议记录。';
  }
  
  const stats = await getAdviceStats(playerId);
  
  let summary = `近期建议记录（共${stats.total}条建议）：\n`;
  
  for (const h of history) {
    summary += `- 第${h.round}回合：建议${h.recommendation.action === 'extract' ? '撤离' : '探索'}（${h.personality}风格），`;
    summary += `玩家${h.decision === 'follow' ? '采纳' : h.decision === 'ignore' ? '忽略' : '反着做'}，`;
    summary += `结果：${h.valueChange > 0 ? '+' : ''}${h.valueChange}\n`;
  }
  
  summary += `\n采纳率：${stats.followRate}%，`;
  summary += `采纳后平均收益：${stats.avgFollowValue > 0 ? '+' : ''}${stats.avgFollowValue}，`;
  summary += `忽略后平均收益：${stats.avgIgnoreValue > 0 ? '+' : ''}${stats.avgIgnoreValue}`;
  
  return summary;
}
