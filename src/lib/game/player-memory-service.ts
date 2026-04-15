// 玩家记忆服务

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PlayerMemoryInput, PlayerMemoryOutput } from '@/lib/ai/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// 获取玩家记忆画像
export async function getPlayerMemory(playerId: string) {
  const db = getSupabase();
  
  if (!db) {
    return {
      player_id: playerId,
      style_tag: 'unknown',
      style_score: { riskTaking: 50, patience: 50, efficiency: 50 },
      key_memories: [],
      personality_traits: [],
      milestones: [],
      recent_runs: [],
    };
  }
  
  const { data, error } = await db
    .from('player_memory')
    .select('*')
    .eq('player_id', playerId)
    .single();
  
  if (error || !data) {
    // 创建新记录
    const { data: newData } = await db
      .from('player_memory')
      .insert({
        player_id: playerId,
        style_tag: 'unknown',
        style_score: { riskTaking: 50, patience: 50, efficiency: 50 },
        key_memories: [],
        personality_traits: [],
        milestones: [],
        recent_runs: [],
      })
      .select()
      .single();
    
    return newData || {
      player_id: playerId,
      style_tag: 'unknown',
      style_score: { riskTaking: 50, patience: 50, efficiency: 50 },
      key_memories: [],
      personality_traits: [],
      milestones: [],
      recent_runs: [],
    };
  }
  
  return data;
}

// 更新玩家记忆
export async function updatePlayerMemory(
  playerId: string,
  updates: Partial<{
    styleTag: string;
    styleScore: { riskTaking: number; patience: number; efficiency: number };
    summaryForAI: string;
    keyMemories: string[];
    personalityTraits: string[];
    milestones: any[];
    recentRuns: any[];
  }>
) {
  const db = getSupabase();
  if (!db) return null;
  
  const updateData: any = {};
  
  if (updates.styleTag !== undefined) updateData.style_tag = updates.styleTag;
  if (updates.styleScore !== undefined) updateData.style_score = updates.styleScore;
  if (updates.summaryForAI !== undefined) updateData.summary_for_ai = updates.summaryForAI;
  if (updates.keyMemories !== undefined) updateData.key_memories = updates.keyMemories;
  if (updates.personalityTraits !== undefined) updateData.personality_traits = updates.personalityTraits;
  if (updates.milestones !== undefined) updateData.milestones = updates.milestones;
  if (updates.recentRuns !== undefined) updateData.recent_runs = updates.recentRuns;
  
  updateData.updated_at = new Date().toISOString();
  
  const { data, error } = await db
    .from('player_memory')
    .update(updateData)
    .eq('player_id', playerId)
    .select()
    .single();
  
  if (error) return null;
  return data;
}

// 添加关键记忆
export async function addKeyMemory(playerId: string, memory: string) {
  const current = await getPlayerMemory(playerId);
  const memories = current.key_memories || [];
  
  // 去重
  if (memories.includes(memory)) return current;
  
  // 限制数量
  const newMemories = [memory, ...memories].slice(0, 20);
  
  return updatePlayerMemory(playerId, { keyMemories: newMemories });
}

// 添加里程碑
export async function addMilestone(playerId: string, milestone: {
  type: string;
  title: string;
  description: string;
  value?: number;
}) {
  const current = await getPlayerMemory(playerId);
  const milestones = current.milestones || [];
  
  const newMilestone = {
    ...milestone,
    achievedAt: new Date().toISOString(),
  };
  
  return updatePlayerMemory(playerId, {
    milestones: [newMilestone, ...milestones].slice(0, 50),
  });
}

// 更新最近对局记录
export async function addRecentRun(playerId: string, run: {
  success: boolean;
  value: number;
  style: string;
  zones: string[];
  highlights: string[];
}) {
  const current = await getPlayerMemory(playerId);
  const runs = current.recent_runs || [];
  
  const newRun = {
    ...run,
    playedAt: new Date().toISOString(),
  };
  
  return updatePlayerMemory(playerId, {
    recentRuns: [newRun, ...runs].slice(0, 20),
  });
}

// 计算玩家风格
export async function calculatePlayerStyle(playerId: string): Promise<string> {
  const db = getSupabase();
  if (!db) return 'unknown';
  
  // 获取最近的对局记录
  const { data: runs } = await db
    .from('player_memory')
    .select('recent_runs')
    .eq('player_id', playerId)
    .single();
  
  const recentRuns = runs?.recent_runs || [];
  
  if (recentRuns.length < 3) {
    return 'unknown';
  }
  
  // 分析风格
  const last10 = recentRuns.slice(0, 10);
  
  let aggressive = 0;
  let conservative = 0;
  
  for (const run of last10) {
    // 高风险高回报策略视为激进
    if (run.style === 'aggressive' || (run.value > 5000 && run.success)) {
      aggressive++;
    }
    // 稳定撤离视为保守
    if (run.style === 'conservative' || (run.success && run.value < 3000)) {
      conservative++;
    }
  }
  
  const ratio = aggressive / last10.length;
  
  if (ratio > 0.6) return 'aggressive';
  if (ratio < 0.3) return 'conservative';
  return 'balanced';
}

// 生成玩家画像摘要
export async function generatePlayerSummary(playerId: string): Promise<PlayerMemoryOutput> {
  const memory = await getPlayerMemory(playerId);
  const db = getSupabase();
  
  let player: any = null;
  if (db) {
    const { data } = await db
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();
    player = data;
  }
  
  if (!player) {
    return {
      summaryForAI: '新玩家，暂无历史数据。',
      keyMemories: [],
      personalityTraits: ['unknown'],
    };
  }
  
  // 构建摘要
  const styleText = memory.style_tag === 'aggressive' ? '激进型' 
    : memory.style_tag === 'conservative' ? '保守型' 
    : memory.style_tag === 'balanced' ? '均衡型' : '风格未知';
  
  let summaryForAI = `${player.name || '玩家'}，${styleText}玩家。`;
  
  const details: string[] = [];
  
  if (player.total_games > 0) {
    details.push(`已完成${player.total_games}局游戏`);
  }
  
  if (player.max_profit > 0) {
    details.push(`最高单局收益${player.max_profit}`);
  }
  
  if (player.kill_count > 0) {
    details.push(`累计击杀${player.kill_count}人`);
  }
  
  if (details.length > 0) {
    summaryForAI += '\n' + details.join('，') + '。';
  }
  
  // 关键记忆
  const keyMemories = [
    ...(memory.key_memories || []),
    ...(memory.milestones || []).slice(0, 3).map((m: any) => m.title),
  ];
  
  // 性格标签
  const personalityTraits = [
    memory.style_tag || 'unknown',
    ...(memory.personality_traits || []),
  ];
  
  return {
    summaryForAI,
    keyMemories: [...new Set(keyMemories)].slice(0, 10),
    personalityTraits: [...new Set(personalityTraits)].slice(0, 5),
  };
}

// 同步玩家记忆（从游戏记录更新）
export async function syncPlayerMemoryFromRuns(playerId: string) {
  const db = getSupabase();
  if (!db) return;
  
  // 获取最近对局
  const { data: runs } = await db
    .from('game_runs')
    .select('result, events, stats')
    .eq('player_id', playerId)
    .order('started_at', { ascending: false })
    .limit(20);
  
  if (!runs || runs.length === 0) return;
  
  // 提取关键信息
  const recentRuns = runs.map(r => ({
    success: r.result?.success || false,
    value: r.result?.finalValue || 0,
    style: r.stats?.style || 'unknown',
    zones: r.events?.map((e: any) => e.zone) || [],
    highlights: r.stats?.highlights || [],
  }));
  
  // 计算风格
  const styleTag = await calculatePlayerStyle(playerId);
  
  // 更新记忆
  await updatePlayerMemory(playerId, {
    recentRuns,
    styleTag,
  });
}
