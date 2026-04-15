// Supabase 服务层 - 数据持久化

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { PlayerState, InventoryItem, Equipment } from './types';

// 数据库类型定义
interface DbPlayer {
  id: string;
  name: string;
  coins: number;
  is_alive: boolean;
  current_hp: number;
  max_hp: number;
  current_zone: string | null;
  game_status: string;
  kill_count: number;
  total_loot_value: number;
  red_count: number;
  max_profit: number;
  total_games: number;
  last_login: string | null;
  created_at: string;
  updated_at: string | null;
}

interface DbPlayerEquipment {
  id: string;
  player_id: string;
  equipment_id: string;
  equipment_name: string;
  quality: string;
  value: number;
  rarity: string;
  stats: any;
  is_looted: boolean;
  slot_type?: string; // 'equipment_slot' | 'inventory' | 'safebox'
  slot_index?: number; // 在槽位中的位置
  created_at: string;
}

interface DbPlayerItem {
  id: string;
  player_id: string;
  item_type: string;
  item_name: string;
  quantity: number;
  effect: any;
  is_equipped: boolean;
  created_at: string;
}

interface DbLeaderboard {
  id: string;
  player_id: string;
  player_name: string;
  total_value: number;
  kill_count: number;
  equipment_count: number;
  survived_seconds: number;
  created_at: string;
}

// 广播消息
interface BroadcastMessage {
  id: string;
  type: string;
  message: string;
  timestamp: number;
}

// 内存缓存（用于广播和在线玩家）
const broadcastsCache: BroadcastMessage[] = [];
const onlinePlayersCache = new Map<string, { name: string; lastActive: number }>();

// ==================== 玩家操作 ====================

/**
 * 注册新用户
 * @returns 成功返回玩家信息，失败返回错误信息
 */
export async function registerPlayer(nickname: string): Promise<{ 
  success: boolean; 
  player?: PlayerState; 
  error?: string;
}> {
  const client = getSupabaseClient();
  
  // 检查昵称是否已存在
  const { data: existingPlayers, error: searchError } = await client
    .from('players')
    .select('id, name')
    .eq('name', nickname)
    .limit(1);
  
  if (searchError) {
    console.error('Check nickname error:', searchError);
    return { success: false, error: '系统错误，请重试' };
  }
  
  if (existingPlayers && existingPlayers.length > 0) {
    return { 
      success: false, 
      error: '该昵称已被占用。如需找回账号，请在设置中绑定邮箱后联系客服。' 
    };
  }
  
  // 创建新用户
  const { data: newPlayer, error: createError } = await client
    .from('players')
    .insert({
      name: nickname,
      coins: 2000,
      is_alive: true,
      current_hp: 100,
      max_hp: 100,
      current_zone: 'safe',
      game_status: 'exploring',
      kill_count: 0,
      total_loot_value: 0,
      red_count: 0,
      max_profit: 0,
      total_games: 0,
    })
    .select()
    .single();
  
  if (createError || !newPlayer) {
    console.error('Create player error:', createError);
    return { success: false, error: '注册失败，请重试' };
  }
  
  // 更新在线玩家缓存
  onlinePlayersCache.set((newPlayer as DbPlayer).id, {
    name: nickname,
    lastActive: Date.now(),
  });
  
  return { 
    success: true, 
    player: mapDbPlayerToPlayer(newPlayer as DbPlayer, [], []) 
  };
}

/**
 * 登录（通过昵称）
 * @returns 成功返回玩家信息，失败返回错误信息
 */
export async function loginPlayer(nickname: string): Promise<{ 
  success: boolean; 
  player?: PlayerState; 
  error?: string;
}> {
  const client = getSupabaseClient();
  
  // 查询玩家
  const { data: players, error: searchError } = await client
    .from('players')
    .select('*')
    .eq('name', nickname)
    .limit(1);
  
  if (searchError) {
    console.error('Login search error:', searchError);
    return { success: false, error: '系统错误，请重试' };
  }
  
  if (!players || players.length === 0) {
    return { success: false, error: '昵称不存在，请注册' };
  }
  
  const dbPlayer = players[0] as DbPlayer;
  
  // 更新最后登录时间
  await client
    .from('players')
    .update({ last_login: new Date().toISOString() })
    .eq('id', dbPlayer.id);
  
  // 获取玩家装备
  const { data: equipment } = await client
    .from('player_equipment')
    .select('*')
    .eq('player_id', dbPlayer.id);
  
  // 获取玩家道具
  const { data: items } = await client
    .from('player_items')
    .select('*')
    .eq('player_id', dbPlayer.id);
  
  // 更新在线缓存
  onlinePlayersCache.set(dbPlayer.id, {
    name: nickname,
    lastActive: Date.now(),
  });
  
  return { 
    success: true, 
    player: mapDbPlayerToPlayer(dbPlayer, equipment || [], items || []) 
  };
}

/**
 * 创建或获取玩家（兼容旧版本）
 */
export async function getOrCreatePlayer(playerName: string): Promise<PlayerState> {
  const client = getSupabaseClient();
  
  // 先查找是否存在
  const { data: existingPlayers, error: searchError } = await client
    .from('players')
    .select('*')
    .eq('name', playerName)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (searchError) {
    console.error('Search player error:', searchError);
  }
  
  if (existingPlayers && existingPlayers.length > 0) {
    const dbPlayer = existingPlayers[0] as DbPlayer;
    
    // 获取玩家装备
    const { data: equipment } = await client
      .from('player_equipment')
      .select('*')
      .eq('player_id', dbPlayer.id);
    
    // 获取玩家道具
    const { data: items } = await client
      .from('player_items')
      .select('*')
      .eq('player_id', dbPlayer.id);
    
    return mapDbPlayerToPlayer(dbPlayer, equipment || [], items || []);
  }
  
  // 创建新玩家
  const { data: newPlayer, error: createError } = await client
    .from('players')
    .insert({
      name: playerName,
      coins: 100,
      is_alive: true,
      current_hp: 100,
      max_hp: 100,
      current_zone: 'safe',
      game_status: 'exploring',
      kill_count: 0,
      total_loot_value: 0,
    })
    .select()
    .single();
  
  if (createError || !newPlayer) {
    console.error('Create player error:', createError);
    throw new Error('创建玩家失败');
  }
  
  // 更新在线玩家缓存
  onlinePlayersCache.set((newPlayer as DbPlayer).id, {
    name: playerName,
    lastActive: Date.now(),
  });
  
  return mapDbPlayerToPlayer(newPlayer as DbPlayer, [], []);
}

/**
 * 获取玩家
 */
export async function getPlayer(playerId: string): Promise<PlayerState | null> {
  const client = getSupabaseClient();
  
  const { data: player, error } = await client
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();
  
  if (error || !player) {
    return null;
  }
  
  // 获取玩家装备
  const { data: equipment } = await client
    .from('player_equipment')
    .select('*')
    .eq('player_id', playerId);
  
  // 获取玩家道具
  const { data: items } = await client
    .from('player_items')
    .select('*')
    .eq('player_id', playerId);
  
  // 更新在线缓存
  onlinePlayersCache.set(playerId, {
    name: (player as DbPlayer).name,
    lastActive: Date.now(),
  });
  
  return mapDbPlayerToPlayer(player as DbPlayer, equipment || [], items || []);
}

/**
 * 更新玩家
 */
export async function updatePlayer(player: PlayerState): Promise<void> {
  const client = getSupabaseClient();
  
  // 更新玩家基本信息
  const { error: playerError } = await client
    .from('players')
    .update({
      coins: player.money,
      is_alive: player.isAlive,
      current_hp: player.currentHp,
      max_hp: player.maxHp,
      current_zone: player.currentZone,
      game_status: player.isAlive ? 'exploring' : 'dead',
      kill_count: player.killCount || 0,
      total_loot_value: player.totalExtractValue || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', player.id);
  
  if (playerError) {
    console.error('Update player error:', playerError);
    throw new Error('更新玩家失败');
  }
  
  // 更新装备 - 先删除旧装备
  await client
    .from('player_equipment')
    .delete()
    .eq('player_id', player.id);
  
  // 插入新装备
  if (player.inventory.length > 0) {
    const equipmentRecords = player.inventory
      .filter((item: InventoryItem) => item.type === 'equipment')
      .map((item: InventoryItem) => {
        const eq = item.item as Equipment;
        return {
          player_id: player.id,
          equipment_id: eq.id,
          equipment_name: eq.name,
          quality: eq.quality,
          value: eq.totalValue,
          rarity: eq.description || '',
          stats: eq.affixes,
          is_looted: true,
        };
      });
    
    if (equipmentRecords.length > 0) {
      await client
        .from('player_equipment')
        .insert(equipmentRecords);
    }
  }
  
  // 更新道具 - 先删除旧道具
  await client
    .from('player_items')
    .delete()
    .eq('player_id', player.id);
  
  // 插入新道具
  if (player.items && player.items.length > 0) {
    const itemRecords = player.items.map((item: any) => ({
      player_id: player.id,
      item_type: item.type,
      item_name: item.name,
      quantity: item.quantity,
      effect: item.effect,
      is_equipped: item.isEquipped || false,
    }));
    
    await client
      .from('player_items')
      .insert(itemRecords);
  }
  
  // 更新在线缓存
  onlinePlayersCache.set(player.id, {
    name: player.name,
    lastActive: Date.now(),
  });
}

// ==================== 排行榜操作 ====================

/**
 * 获取排行榜
 */
export async function getLeaderboards(): Promise<any[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('leaderboard')
    .select('*')
    .order('total_value', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('Get leaderboard error:', error);
    return [];
  }
  
  return (data || []).map((item: DbLeaderboard) => ({
    playerName: item.player_name,
    totalValue: item.total_value,
    killCount: item.kill_count,
    equipmentCount: item.equipment_count,
    survivedSeconds: item.survived_seconds,
    timestamp: new Date(item.created_at).getTime(),
  }));
}

/**
 * 更新排行榜
 */
export async function updateLeaderboards(
  player: PlayerState,
  totalValue: number
): Promise<void> {
  const client = getSupabaseClient();
  
  // 计算存活时间
  const playerData = await client
    .from('players')
    .select('created_at')
    .eq('id', player.id)
    .single();
  
  let survivedSeconds = 0;
  if (playerData.data) {
    const createdAt = new Date((playerData.data as any).created_at).getTime();
    survivedSeconds = Math.floor((Date.now() - createdAt) / 1000);
  }
  
  // 插入排行榜记录
  await client
    .from('leaderboard')
    .insert({
      player_id: player.id,
      player_name: player.name,
      total_value: totalValue,
      kill_count: player.killCount || 0,
      equipment_count: player.inventory.length,
      survived_seconds: survivedSeconds,
    });
}

/**
 * 获取玩家排名
 */
export async function getPlayerRank(playerName: string): Promise<number | null> {
  const client = getSupabaseClient();
  
  // 获取该玩家的最高记录
  const { data: playerRecords, error } = await client
    .from('leaderboard')
    .select('total_value')
    .eq('player_name', playerName)
    .order('total_value', { ascending: false })
    .limit(1);
  
  if (error || !playerRecords || playerRecords.length === 0) {
    return null;
  }
  
  const bestValue = (playerRecords[0] as any).total_value;
  
  // 查询比该玩家高的记录数
  const { count, error: countError } = await client
    .from('leaderboard')
    .select('*', { count: 'exact', head: true })
    .gt('total_value', bestValue);
  
  if (countError) {
    return null;
  }
  
  return (count || 0) + 1;
}

// ==================== 广播操作 ====================

/**
 * 添加广播消息
 */
export function addBroadcast(broadcast: { type: string; message: string }): void {
  const broadcastMsg: BroadcastMessage = {
    id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: broadcast.type,
    message: broadcast.message,
    timestamp: Date.now(),
  };
  
  broadcastsCache.unshift(broadcastMsg);
  
  // 只保留最近50条
  if (broadcastsCache.length > 50) {
    broadcastsCache.pop();
  }
}

/**
 * 获取广播消息
 */
export function getBroadcasts(): BroadcastMessage[] {
  // 清理超过5分钟的广播
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const validBroadcasts = broadcastsCache.filter(b => b.timestamp > fiveMinutesAgo);
  
  return validBroadcasts.slice(0, 20);
}

// ==================== 在线玩家操作 ====================

/**
 * 获取在线玩家
 */
export function getOnlinePlayers(): { name: string }[] {
  // 清理超过2分钟未活跃的玩家
  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
  
  for (const [id, player] of onlinePlayersCache.entries()) {
    if (player.lastActive < twoMinutesAgo) {
      onlinePlayersCache.delete(id);
    }
  }
  
  return Array.from(onlinePlayersCache.values()).map(p => ({ name: p.name }));
}

// ==================== 工具函数 ====================

/**
 * 映射数据库玩家对象到应用玩家对象
 */
function mapDbPlayerToPlayer(
  dbPlayer: DbPlayer,
  equipment: DbPlayerEquipment[],
  items: DbPlayerItem[]
): PlayerState {
  // 分别存储不同位置的装备
  const equipmentSlots: InventoryItem[] = [];
  const inventory: InventoryItem[] = [];
  const safeBox: InventoryItem[] = [];
  
  for (const eq of equipment) {
    const item: InventoryItem = {
      type: 'equipment' as const,
      item: {
        id: eq.equipment_id,
        name: eq.equipment_name,
        quality: eq.quality as any,
        affixes: eq.stats || [],
        baseValue: eq.value,
        totalValue: eq.value,
        description: eq.rarity || '',
      } as Equipment,
    };
    
    // 根据 slot_type 分配到不同的槽位
    const slotType = eq.slot_type || 'inventory'; // 默认放入背包（兼容旧数据）
    if (slotType === 'equipment_slot') {
      equipmentSlots.push(item);
    } else if (slotType === 'safebox') {
      safeBox.push(item);
    } else {
      inventory.push(item);
    }
  }
  
  const playerItems = items.map((item: DbPlayerItem) => ({
    type: item.item_type,
    name: item.item_name,
    quantity: item.quantity,
    effect: item.effect,
    isEquipped: item.is_equipped,
  }));
  
  return {
    id: dbPlayer.id,
    name: dbPlayer.name,
    money: dbPlayer.coins,
    isAlive: dbPlayer.is_alive,
    currentHp: dbPlayer.current_hp,
    maxHp: dbPlayer.max_hp,
    currentZone: dbPlayer.current_zone || 'safe',
    equipmentSlots,
    inventory,
    safeBox,
    items: playerItems,
    killCount: dbPlayer.kill_count,
    totalExtractValue: dbPlayer.total_loot_value,
    redDropCount: dbPlayer.red_count,
    maxProfit: dbPlayer.max_profit,
    totalGames: dbPlayer.total_games,
    lastLogin: dbPlayer.last_login,
    currentRound: 0,
    winStreak: 0,
    failStreak: 0,
    noDropStreak: 0,
    bonusDropRate: 0,
    combatWinRateBonus: 0,
    extractRateBonus: 0,
  };
}
