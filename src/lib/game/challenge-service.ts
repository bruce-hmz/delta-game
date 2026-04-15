// 每日挑战服务

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

// 每日挑战定义
export const DAILY_CHALLENGE_DEFINITIONS = [
  // 战斗类
  { code: 'daily_kill_3', category: 'combat', name: '今日目标：击杀', description: '在今日对局中累计击杀3名敌人', icon: '⚔️', condition: { type: 'kill', value: 3 }, difficulty: 'easy', reward: { coins: 200 }, displayOrder: 1 },
  { code: 'daily_kill_10', category: 'combat', name: '今日目标：击杀++', description: '在今日对局中累计击杀10名敌人', icon: '💀', condition: { type: 'kill', value: 10 }, difficulty: 'hard', reward: { coins: 800 }, displayOrder: 2 },
  { code: 'daily_extract_2', category: 'combat', name: '活着回来', description: '今日成功撤离2次', icon: '🏃', condition: { type: 'extract', value: 2 }, difficulty: 'normal', reward: { coins: 400 }, displayOrder: 3 },
  
  // 探索类
  { code: 'daily_boss_1', category: 'exploration', name: 'BOSS猎人', description: '今日击败1个BOSS', icon: '👹', condition: { type: 'boss', value: 1 }, difficulty: 'normal', reward: { coins: 500 }, displayOrder: 10 },
  { code: 'daily_loot_5000', category: 'exploration', name: '满载而归', description: '今日单局携带价值超过5000撤离', icon: '💎', condition: { type: 'carry_value', value: 5000 }, difficulty: 'hard', reward: { coins: 600 }, displayOrder: 11 },
  { code: 'daily_loot_2000', category: 'exploration', name: '小有收获', description: '今日单局携带价值超过2000撤离', icon: '💰', condition: { type: 'carry_value', value: 2000 }, difficulty: 'easy', reward: { coins: 300 }, displayOrder: 12 },
  
  // 生存类
  { code: 'daily_rounds_10', category: 'survival', name: '持久作战', description: '今日累计存活回合超过10', icon: '🕐', condition: { type: 'rounds', value: 10 }, difficulty: 'normal', reward: { coins: 300 }, displayOrder: 20 },
  { code: 'daily_death_0', category: 'survival', name: '零伤亡', description: '今日所有对局均成功撤离', icon: '🛡️', condition: { type: 'no_death', value: 3 }, difficulty: 'hard', reward: { coins: 700 }, displayOrder: 21 },
  
  // 财富类
  { code: 'daily_profit_3000', category: 'wealth', name: '日进斗金', description: '今日累计收益超过3000', icon: '🪙', condition: { type: 'profit', value: 3000 }, difficulty: 'normal', reward: { coins: 400 }, displayOrder: 22 },
  { code: 'daily_games_3', category: 'wealth', name: '勤奋冒险者', description: '今日完成3局游戏', icon: '🎮', condition: { type: 'games', value: 3 }, difficulty: 'easy', reward: { coins: 200 }, displayOrder: 23 },
];

// 获取今日挑战
export async function getDailyChallenges(playerId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  // 获取今日定义的挑战
  const definitions = DAILY_CHALLENGE_DEFINITIONS;
  
  const db = getSupabase();
  let progress: any[] = [];
  
  if (db) {
    const { data, error } = await db
      .from('player_daily_challenges')
      .select('*')
      .eq('player_id', playerId)
      .eq('challenge_date', today);
    
    if (!error && data) {
      progress = data;
    }
  }
  
  // 合并数据
  return definitions.map(c => {
    const p = progress.find(item => item.challenge_code === c.code);
    return {
      ...c,
      currentProgress: p?.current_progress || 0,
      targetValue: c.condition?.value || 1,
      status: p?.status || 'active',
      completedAt: p?.completed_at,
      rewardClaimed: p?.reward_claimed || false,
    };
  });
}

// 更新挑战进度
export async function updateChallengeProgress(playerId: string, type: string, value: number, metadata?: any) {
  const today = new Date().toISOString().split('T')[0];
  const db = getSupabase();
  
  if (!db) return [];
  
  // 查找匹配今日挑战
  const matchingChallenges = DAILY_CHALLENGE_DEFINITIONS.filter(c => c.condition?.type === type);
  
  const results = [];
  
  for (const def of matchingChallenges) {
    const { data: existing } = await db
      .from('player_daily_challenges')
      .select('*')
      .eq('player_id', playerId)
      .eq('challenge_code', def.code)
      .eq('challenge_date', today)
      .single();
    
    let newProgress = value;
    if (existing) {
      newProgress = existing.current_progress + value;
    }
    
    const target = def.condition?.value || 1;
    const isCompleted = newProgress >= target;
    
    if (existing) {
      const { data } = await db
        .from('player_daily_challenges')
        .update({
          current_progress: newProgress,
          status: isCompleted ? 'completed' : 'active',
          completed_at: isCompleted && existing.status !== 'completed' ? new Date().toISOString() : existing.completed_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (data && isCompleted && existing.status !== 'completed') {
        results.push({ code: def.code, completed: true });
      }
    } else {
      const { data } = await db
        .from('player_daily_challenges')
        .insert({
          player_id: playerId,
          challenge_code: def.code,
          challenge_date: today,
          current_progress: newProgress,
          target_value: target,
          status: isCompleted ? 'completed' : 'active',
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .select()
        .single();
      
      if (data && isCompleted) {
        results.push({ code: def.code, completed: true });
      }
    }
  }
  
  return results;
}

// 领取挑战奖励
export async function claimChallengeReward(playerId: string, challengeCode: string) {
  const today = new Date().toISOString().split('T')[0];
  const db = getSupabase();
  
  if (!db) throw new Error('Database not available');
  
  const def = DAILY_CHALLENGE_DEFINITIONS.find(d => d.code === challengeCode);
  if (!def) throw new Error('Challenge not found');
  
  const { data: progress } = await db
    .from('player_daily_challenges')
    .select('*')
    .eq('player_id', playerId)
    .eq('challenge_code', challengeCode)
    .eq('challenge_date', today)
    .single();
  
  if (!progress || progress.status !== 'completed' || progress.reward_claimed) {
    throw new Error('Cannot claim reward');
  }
  
  // 发放奖励
  const reward = def.reward as any;
  if (reward.coins) {
    await db.rpc('increment_coins', { player_id: playerId, amount: reward.coins });
  }
  
  // 标记已领取
  await db
    .from('player_daily_challenges')
    .update({ reward_claimed: true, updated_at: new Date().toISOString() })
    .eq('id', progress.id);
  
  return reward;
}

// 检查特殊挑战状态（零伤亡等）
export async function checkSpecialChallenges(playerId: string) {
  const today = new Date().toISOString().split('T')[0];
  const db = getSupabase();
  
  if (!db) return { todayDeaths: 0, todayExtracts: 0 };
  
  // 检查是否有死亡记录
  const { data: deaths } = await db
    .from('game_runs')
    .select('id')
    .eq('player_id', playerId)
    .eq('status', 'dead')
    .gte('started_at', `${today}T00:00:00`);
  
  const { data: extracts } = await db
    .from('game_runs')
    .select('id')
    .eq('player_id', playerId)
    .eq('status', 'extracted')
    .gte('started_at', `${today}T00:00:00`);
  
  // 如果今日有死亡，清除零伤亡挑战进度
  if (deaths && deaths.length > 0) {
    await db
      .from('player_daily_challenges')
      .update({ status: 'expired' })
      .eq('player_id', playerId)
      .eq('challenge_code', 'daily_death_0')
      .eq('challenge_date', today);
  }
  
  return {
    todayDeaths: deaths?.length || 0,
    todayExtracts: extracts?.length || 0,
  };
}
