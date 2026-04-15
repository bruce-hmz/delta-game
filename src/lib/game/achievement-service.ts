// 成就系统服务

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

// 成就定义
export const ACHIEVEMENT_DEFINITIONS = [
  // 战斗类
  { code: 'first_blood', category: 'combat', name: '初战告捷', description: '完成第一场战斗', icon: '⚔️', condition: { type: 'kill_count', value: 1 }, reward: { coins: 100 }, displayOrder: 1 },
  { code: 'kill_10', category: 'combat', name: '战士', description: '累计击杀10名敌人', icon: '🗡️', condition: { type: 'kill_count', value: 10 }, reward: { coins: 500 }, displayOrder: 2 },
  { code: 'kill_50', category: 'combat', name: '佣兵', description: '累计击杀50名敌人', icon: '💀', condition: { type: 'kill_count', value: 50 }, reward: { coins: 2000 }, displayOrder: 3 },
  { code: 'red_5', category: 'combat', name: '开红达人', description: '累计开红5次', icon: '🔥', condition: { type: 'red_count', value: 5 }, reward: { coins: 500 }, displayOrder: 4 },
  
  // 探索类
  { code: 'boss_1', category: 'exploration', name: 'BOSS猎手', description: '击败1个BOSS', icon: '👹', condition: { type: 'boss_kill', value: 1 }, reward: { coins: 300 }, displayOrder: 10 },
  { code: 'zones_5', category: 'exploration', name: '探索者', description: '探索5个不同区域', icon: '🗺️', condition: { type: 'zones_visited', value: 5 }, reward: { coins: 500 }, displayOrder: 11 },
  { code: 'loot_10000', category: 'exploration', name: '掠夺者', description: '单局携带价值超过10000', icon: '💎', condition: { type: 'max_carry', value: 10000 }, reward: { coins: 800 }, displayOrder: 12 },
  
  // 财富类
  { code: 'profit_5000', category: 'wealth', name: '小有身家', description: '单局收益超过5000', icon: '💰', condition: { type: 'single_profit', value: 5000 }, reward: { coins: 500 }, displayOrder: 20 },
  { code: 'profit_20000', category: 'wealth', name: '富豪', description: '单局收益超过20000', icon: '🪙', condition: { type: 'single_profit', value: 20000 }, reward: { coins: 2000 }, displayOrder: 21 },
  { code: 'total_100000', category: 'wealth', name: '财富自由', description: '累计收益超过100000', icon: '🏆', condition: { type: 'total_profit', value: 100000 }, reward: { coins: 5000 }, displayOrder: 22 },
  
  // 生存类
  { code: 'extract_10', category: 'survival', name: '老兵', description: '成功撤离10次', icon: '🛡️', condition: { type: 'extract_count', value: 10 }, reward: { coins: 800 }, displayOrder: 30 },
  { code: 'extract_50', category: 'survival', name: '精英', description: '成功撤离50次', icon: '⭐', condition: { type: 'extract_count', value: 50 }, reward: { coins: 3000 }, displayOrder: 31 },
  { code: 'survive_100', category: 'survival', name: '不死的传说', description: '累计存活回合超过100', icon: '👻', condition: { type: 'total_rounds', value: 100 }, reward: { coins: 2000 }, displayOrder: 32 },
  
  // 特殊类
  { code: 'first_game', category: 'special', name: '新人报到', description: '完成第一局游戏', icon: '🎮', condition: { type: 'total_games', value: 1 }, reward: { coins: 50 }, displayOrder: 40 },
  { code: 'games_10', category: 'special', name: '常客', description: '累计游戏10局', icon: '🎯', condition: { type: 'total_games', value: 10 }, reward: { coins: 300 }, displayOrder: 41 },
  { code: 'daily_challenge_5', category: 'special', name: '挑战者', description: '完成5次每日挑战', icon: '📅', condition: { type: 'daily_challenges_completed', value: 5 }, reward: { coins: 500 }, displayOrder: 42 },
];

// 获取玩家成就列表
export async function getPlayerAchievements(playerId: string) {
  const db = getSupabase();
  
  let achievements: any[] = ACHIEVEMENT_DEFINITIONS;
  let playerProgress: any[] = [];
  
  if (db) {
    const { data, error } = await db
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    
    if (!error && data && data.length > 0) {
      achievements = data;
    }
    
    const { data: progress, error: progressError } = await db
      .from('player_achievements')
      .select('*')
      .eq('player_id', playerId);
    
    if (!progressError && progress) {
      playerProgress = progress;
    }
  }
  
  // 合并数据
  return achievements.map(a => {
    const progress = playerProgress.find(p => p.achievement_code === a.code);
    return {
      ...a,
      currentProgress: progress?.current_progress || 0,
      targetValue: a.condition?.value || 1,
      status: progress?.status || 'locked',
      completedAt: progress?.completed_at,
      rewardClaimed: progress?.reward_claimed || false,
    };
  });
}

// 更新成就进度
export async function updateAchievementProgress(playerId: string, type: string, value: number) {
  const db = getSupabase();
  if (!db) return;
  
  const { data: definitions, error } = await db
    .from('achievements')
    .select('*')
    .eq('is_active', true);
  
  if (error || !definitions) return;
  
  for (const def of definitions) {
    const condition = def.condition as any;
    if (condition.type !== type) continue;
    
    // 获取或创建进度记录
    const { data: existing } = await db
      .from('player_achievements')
      .select('*')
      .eq('player_id', playerId)
      .eq('achievement_code', def.code)
      .single();
    
    const newProgress = value;
    const target = condition.value;
    const isCompleted = newProgress >= target;
    
    if (existing) {
      // 更新进度
      await db
        .from('player_achievements')
        .update({
          current_progress: newProgress,
          status: isCompleted ? 'completed' : 'in_progress',
          completed_at: isCompleted && existing.status !== 'completed' ? new Date().toISOString() : existing.completed_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // 创建进度记录
      await db.from('player_achievements').insert({
        player_id: playerId,
        achievement_code: def.code,
        current_progress: newProgress,
        target_value: target,
        status: isCompleted ? 'completed' : 'in_progress',
        completed_at: isCompleted ? new Date().toISOString() : null,
      });
    }
  }
}

// 领取成就奖励
export async function claimAchievementReward(playerId: string, achievementCode: string) {
  const db = getSupabase();
  if (!db) throw new Error('Database not available');
  
  // 获取成就信息
  const { data: achievement } = await db
    .from('achievements')
    .select('*')
    .eq('code', achievementCode)
    .single();
  
  if (!achievement) throw new Error('Achievement not found');
  
  // 获取玩家进度
  const { data: progress } = await db
    .from('player_achievements')
    .select('*')
    .eq('player_id', playerId)
    .eq('achievement_code', achievementCode)
    .single();
  
  if (!progress || progress.status !== 'completed' || progress.reward_claimed) {
    throw new Error('Cannot claim reward');
  }
  
  // 发放奖励
  const reward = achievement.reward as any;
  if (reward.coins) {
    await db.rpc('increment_coins', { player_id: playerId, amount: reward.coins });
  }
  
  // 标记已领取
  await db
    .from('player_achievements')
    .update({ reward_claimed: true, updated_at: new Date().toISOString() })
    .eq('id', progress.id);
  
  return reward;
}

// 初始化玩家成就（首次登录时）
export async function initializePlayerAchievements(playerId: string) {
  const db = getSupabase();
  if (!db) return;
  
  const { data: existing } = await db
    .from('player_achievements')
    .select('achievement_code')
    .eq('player_id', playerId);
  
  if (existing && existing.length > 0) return;
  
  // 批量初始化所有成就
  const inserts = ACHIEVEMENT_DEFINITIONS.map(def => ({
    player_id: playerId,
    achievement_code: def.code,
    current_progress: 0,
    target_value: def.condition.value,
    status: 'locked',
  }));
  
  await db.from('player_achievements').insert(inserts);
}
