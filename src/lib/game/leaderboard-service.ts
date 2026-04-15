// 排行榜增强服务

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

// 排行榜类型
export type LeaderboardType = 'daily' | 'weekly' | 'monthly' | 'all';

// 获取排行榜
export async function getLeaderboard(
  type: LeaderboardType = 'all',
  limit: number = 50
) {
  const db = getSupabase();
  
  if (!db) return [];
  
  let query = db
    .from('leaderboard')
    .select('*')
    .order('totalValue', { ascending: false })
    .limit(limit);
  
  const { data, error } = await query;
  
  if (error || !data) return [];
  
  // 添加排名
  return data.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

// 获取玩家排名
export async function getPlayerRank(playerId: string, type: LeaderboardType = 'all') {
  const db = getSupabase();
  
  if (!db) return { rank: null, score: 0 };
  
  // 获取玩家分数
  const { data: player } = await db
    .from('leaderboard')
    .select('*')
    .eq('playerId', playerId)
    .single();
  
  if (!player) {
    return { rank: null, score: 0 };
  }
  
  // 计算排名
  const { count } = await db
    .from('leaderboard')
    .select('*', { count: 'exact', head: true })
    .gt('totalValue', player.totalValue);
  
  return {
    rank: (count || 0) + 1,
    score: player.totalValue,
    playerName: player.playerName,
  };
}

// 获取玩家历史排名
export async function getPlayerRankHistory(playerId: string, period: string = 'weekly') {
  const db = getSupabase();
  
  if (!db) return [];
  
  const { data, error } = await db
    .from('player_rank_history')
    .select('*')
    .eq('player_id', playerId)
    .eq('period', period)
    .order('period_date', { ascending: false })
    .limit(30);
  
  if (error || !data) return [];
  
  return data.map(item => ({
    date: item.period_date,
    rank: item.rank,
    change: item.change,
  }));
}

// 更新排行榜分数
export async function updateLeaderboardScore(
  playerId: string,
  playerName: string,
  addValue: number = 0,
  killCount: number = 0,
  extract: boolean = false
) {
  const db = getSupabase();
  if (!db) return;
  
  // 获取当前记录
  const { data: existing } = await db
    .from('leaderboard')
    .select('*')
    .eq('playerId', playerId)
    .single();
  
  if (existing) {
    // 更新
    await db
      .from('leaderboard')
      .update({
        totalValue: existing.totalValue + addValue,
        killCount: existing.killCount + killCount,
        equipmentCount: extract ? existing.equipmentCount + 1 : existing.equipmentCount,
        playerName,
      })
      .eq('playerId', playerId);
  } else {
    // 创建
    await db.from('leaderboard').insert({
      playerId,
      playerName,
      totalValue: addValue,
      killCount,
      equipmentCount: extract ? 1 : 0,
    });
  }
}

// 获取排行榜快照
export async function getLeaderboardSnapshot(type: 'daily' | 'weekly' | 'monthly') {
  const db = getSupabase();
  if (!db) return [];
  
  const today = new Date();
  let periodStart: string, periodEnd: string;
  
  if (type === 'daily') {
    periodStart = periodEnd = today.toISOString().split('T')[0];
  } else if (type === 'weekly') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    periodStart = weekStart.toISOString().split('T')[0];
    periodEnd = today.toISOString().split('T')[0];
  } else {
    periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    periodEnd = today.toISOString().split('T')[0];
  }
  
  const { data, error } = await db
    .from('leaderboard_snapshots')
    .select('*')
    .eq('period', type)
    .eq('period_start', periodStart)
    .single();
  
  if (error || !data) {
    // 如果没有快照，生成实时排行榜
    return getLeaderboard('all', 100);
  }
  
  return data.rankings;
}

// 创建排行榜快照（定时任务调用）
export async function createLeaderboardSnapshot(type: 'daily' | 'weekly' | 'monthly') {
  const db = getSupabase();
  if (!db) return;
  
  const today = new Date();
  let periodStart: string, periodEnd: string;
  
  if (type === 'daily') {
    periodStart = periodEnd = today.toISOString().split('T')[0];
  } else if (type === 'weekly') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    periodStart = weekStart.toISOString().split('T')[0];
    periodEnd = today.toISOString().split('T')[0];
  } else {
    periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    periodEnd = today.toISOString().split('T')[0];
  }
  
  // 获取当前排行榜前100
  const { data: rankings } = await db
    .from('leaderboard')
    .select('*')
    .order('totalValue', { ascending: false })
    .limit(100);
  
  // 记录快照
  await db.from('leaderboard_snapshots').upsert({
    period: type,
    period_start: periodStart,
    period_end: periodEnd,
    rankings: rankings?.map((r, i) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      score: r.totalValue,
      rank: i + 1,
    })) || [],
    total_players: rankings?.length || 0,
  }, {
    onConflict: 'period,period_start',
  });
  
  // 更新玩家排名历史
  for (const r of rankings || []) {
    await db.from('player_rank_history').insert({
      player_id: r.playerId,
      period: type,
      period_date: periodEnd,
      rank: rankings!.indexOf(r) + 1,
      score: r.totalValue,
      change: 0, // 后续计算
    });
  }
}

// 获取各类别排行榜
export async function getCategoryLeaderboard(category: 'wealth' | 'combat' | 'survival', limit: number = 20) {
  const db = getSupabase();
  
  if (!db) return [];
  
  if (category === 'wealth') {
    // 财富榜
    const { data } = await db
      .from('players')
      .select('id, name, totalLootValue')
      .order('totalLootValue', { ascending: false })
      .limit(limit);
    return data?.map((p, i) => ({ ...p, rank: i + 1 })) || [];
  }
  
  if (category === 'combat') {
    // 战斗榜
    const { data } = await db
      .from('players')
      .select('id, name, killCount')
      .order('killCount', { ascending: false })
      .limit(limit);
    return data?.map((p, i) => ({ ...p, rank: i + 1 })) || [];
  }
  
  if (category === 'survival') {
    // 生存榜（按成功撤离次数）
    const { data } = await db
      .from('players')
      .select('id, name, redCount')
      .order('redCount', { ascending: false })
      .limit(limit);
    return data?.map((p, i) => ({ ...p, rank: i + 1 })) || [];
  }
  
  return [];
}
