// Supabase 服务层 - 简化版鉴权

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { PlayerState, InventoryItem, Equipment, PlayerStyleTag } from './types';
import { calculatePlayerStyle, calculateStyleScore } from './style-calculator';
import crypto from 'crypto';

// 密码 hash 配置
const SALT_LENGTH = 16;
const HASH_ITERATIONS = 10000;
const HASH_KEY_LENGTH = 64;

/**
 * 生成密码 hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, 'sha512').toString('hex');
  return hash === verifyHash;
}

// 数据库类型定义
interface DbPlayer {
  id: string;
  name: string;
  password_hash?: string | null;
  bind_email?: string | null;
  google_id?: string | null;
  google_email?: string | null;
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

// 广播消息
interface BroadcastMessage {
  id: string;
  type: string;
  message: string;
  timestamp: number;
}

// 内存缓存（用于广播）
const broadcastsCache: BroadcastMessage[] = [];

/**
 * 从 Token 获取用户ID
 */
export function getUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Token 格式: userId.timestamp.signature
  try {
    const parts = token.split('.');
    if (parts.length >= 1 && parts[0]) {
      return parts[0];
    }
    return null;
  } catch {
    return null;
  }
}

// ==================== 用户初始化 ====================

/**
 * 检查用户是否已设置昵称
 */
export async function checkUserExists(userId: string): Promise<{
  exists: boolean;
  player?: PlayerState;
}> {
  const client = getSupabaseClient();
  
  const { data: player, error } = await client
    .from('players')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error || !player) {
    return { exists: false };
  }
  
  // 获取装备和道具
  const { data: equipment } = await client
    .from('player_equipment')
    .select('*')
    .eq('player_id', userId);
  
  const { data: items } = await client
    .from('player_items')
    .select('*')
    .eq('player_id', userId);
  
  return {
    exists: true,
    player: mapDbPlayerToPlayer(player as DbPlayer, equipment || [], items || []),
  };
}

/**
 * 初始化用户（设置昵称和密码）
 */
export async function initializeUser(
  userId: string, 
  nickname: string,
  password?: string,
  isGuest?: boolean  // 游客模式
): Promise<{
  success: boolean;
  player?: PlayerState;
  error?: string;
  needLogin?: boolean;  // 昵称已存在，需要登录
}> {
  const client = getSupabaseClient();
  
  // 昵称长度验证
  if (nickname.length < 2 || nickname.length > 12) {
    return { success: false, error: '昵称长度应为2-12个字符' };
  }
  
  // 昵称格式验证
  const nicknameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/;
  if (!nicknameRegex.test(nickname)) {
    return { success: false, error: '昵称只能包含中文、英文、数字和下划线' };
  }
  
  // 游客模式：跳过昵称重复检查，直接创建/更新用户
  if (isGuest) {
    // 检查用户是否已存在
    const { data: existingUser } = await client
      .from('players')
      .select('id, name')
      .eq('id', userId)
      .single();
    
    if (existingUser) {
      // 用户已存在，返回数据
      const { data: equipment } = await client
        .from('player_equipment')
        .select('*')
        .eq('player_id', userId);
      
      const { data: items } = await client
        .from('player_items')
        .select('*')
        .eq('player_id', userId);
      
      return {
        success: true,
        player: mapDbPlayerToPlayer(existingUser as DbPlayer, equipment || [], items || []),
      };
    }
    
    // 创建新用户（游客模式）
    const { data: newPlayer, error: createError } = await client
      .from('players')
      .insert({
        id: userId,
        name: nickname,
        password_hash: null,
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
      console.error('Create guest player error:', createError);
      return { success: false, error: '创建用户失败，请重试' };
    }
    
    return {
      success: true,
      player: mapDbPlayerToPlayer(newPlayer as DbPlayer, [], []),
    };
  }
  
  // 检查昵称是否已存在
  const { data: existingPlayers, error: checkError } = await client
    .from('players')
    .select('id, password_hash')
    .eq('name', nickname)
    .limit(1);
  
  if (checkError) {
    console.error('Check nickname error:', checkError);
  }
  
  if (existingPlayers && existingPlayers.length > 0) {
    const existingPlayer = existingPlayers[0];
    
    // 昵称已存在，检查是否已设置密码
    if (existingPlayer.password_hash) {
      // 已设置密码，需要登录
      return { 
        success: false, 
        needLogin: true,
        error: '该昵称已存在，请使用密码登录' 
      };
    } else {
      // 未设置密码，允许设置密码并关联（找回账号）
      if (!password) {
        return { 
          success: false, 
          error: '该昵称已存在，请输入密码以找回账号' 
        };
      }
      
      // 设置密码并返回该账号
      const passwordHash = hashPassword(password);
      const { data: updatedPlayer, error: updateError } = await client
        .from('players')
        .update({ 
          password_hash: passwordHash,
          updated_at: new Date().toISOString() 
        })
        .eq('id', existingPlayer.id)
        .select()
        .single();
      
      if (updateError || !updatedPlayer) {
        return { success: false, error: '设置密码失败，请重试' };
      }
      
      // 获取装备和道具
      const { data: equipment } = await client
        .from('player_equipment')
        .select('*')
        .eq('player_id', existingPlayer.id);
      
      const { data: items } = await client
        .from('player_items')
        .select('*')
        .eq('player_id', existingPlayer.id);
      
      return {
        success: true,
        player: mapDbPlayerToPlayer(updatedPlayer as DbPlayer, equipment || [], items || []),
      };
    }
  }
  
  // 检查用户是否已存在
  const { data: existingUser } = await client
    .from('players')
    .select('id')
    .eq('id', userId)
    .single();
  
  // 密码验证
  if (password && password.length < 6) {
    return { success: false, error: '密码长度至少6位' };
  }
  
  const passwordHash = password ? hashPassword(password) : null;
  
  if (existingUser) {
    // 更新昵称和密码
    const updateData: any = { 
      name: nickname, 
      updated_at: new Date().toISOString() 
    };
    if (passwordHash) {
      updateData.password_hash = passwordHash;
    }
    
    const { data: updatedPlayer, error: updateError } = await client
      .from('players')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError || !updatedPlayer) {
      return { success: false, error: '设置昵称失败' };
    }
    
    return {
      success: true,
      player: mapDbPlayerToPlayer(updatedPlayer as DbPlayer, [], []),
    };
  }
  
  // 创建用户
  const { data: newPlayer, error: createError } = await client
    .from('players')
    .insert({
      id: userId,
      name: nickname,
      password_hash: passwordHash,
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
    return { success: false, error: '创建用户失败，请重试' };
  }
  
  return {
    success: true,
    player: mapDbPlayerToPlayer(newPlayer as DbPlayer, [], []),
  };
}

/**
 * 使用昵称和密码登录
 */
export async function loginWithNickname(
  nickname: string,
  password: string
): Promise<{
  success: boolean;
  player?: PlayerState;
  userId?: string;
  error?: string;
}> {
  const client = getSupabaseClient();
  
  // 查找用户
  const { data: player, error } = await client
    .from('players')
    .select('*')
    .eq('name', nickname)
    .single();
  
  if (error || !player) {
    return { success: false, error: '昵称不存在' };
  }
  
  const dbPlayer = player as DbPlayer;
  
  // 检查是否设置了密码
  if (!dbPlayer.password_hash) {
    return { success: false, error: '该账号未设置密码，请联系客服找回' };
  }
  
  // 验证密码
  if (!verifyPassword(password, dbPlayer.password_hash)) {
    return { success: false, error: '密码错误' };
  }
  
  // 获取装备和道具
  const { data: equipment } = await client
    .from('player_equipment')
    .select('*')
    .eq('player_id', dbPlayer.id);
  
  const { data: items } = await client
    .from('player_items')
    .select('*')
    .eq('player_id', dbPlayer.id);
  
  return {
    success: true,
    userId: dbPlayer.id,
    player: mapDbPlayerToPlayer(dbPlayer, equipment || [], items || []),
  };
}

/**
 * 使用邮箱和密码登录
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  player?: PlayerState;
  userId?: string;
  error?: string;
}> {
  const client = getSupabaseClient();
  
  // 查找用户（通过绑定邮箱）
  const { data: player, error } = await client
    .from('players')
    .select('*')
    .eq('bind_email', email.toLowerCase())
    .single();
  
  if (error || !player) {
    return { success: false, error: '邮箱未绑定或不存在' };
  }
  
  const dbPlayer = player as DbPlayer;
  
  // 检查是否设置了密码
  if (!dbPlayer.password_hash) {
    return { success: false, error: '该账号未设置密码' };
  }
  
  // 验证密码
  if (!verifyPassword(password, dbPlayer.password_hash)) {
    return { success: false, error: '密码错误' };
  }
  
  // 获取装备和道具
  const { data: equipment } = await client
    .from('player_equipment')
    .select('*')
    .eq('player_id', dbPlayer.id);
  
  const { data: items } = await client
    .from('player_items')
    .select('*')
    .eq('player_id', dbPlayer.id);
  
  return {
    success: true,
    userId: dbPlayer.id,
    player: mapDbPlayerToPlayer(dbPlayer, equipment || [], items || []),
  };
}

// ==================== 游戏操作 ====================

/**
 * 获取玩家数据
 */
export async function getPlayerData(userId: string): Promise<PlayerState | null> {
  const client = getSupabaseClient();
  
  const { data: player, error } = await client
    .from('players')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error || !player) {
    return null;
  }
  
  const { data: equipment } = await client
    .from('player_equipment')
    .select('*')
    .eq('player_id', userId);
  
  const { data: items } = await client
    .from('player_items')
    .select('*')
    .eq('player_id', userId);
  
  return mapDbPlayerToPlayer(player as DbPlayer, equipment || [], items || []);
}

/**
 * 更新玩家数据
 */
export async function updatePlayerData(
  userId: string, 
  player: PlayerState
): Promise<boolean> {
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
      red_count: player.redDropCount || 0,
      max_profit: player.maxProfit || 0,
      total_games: player.totalGames || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  
  if (playerError) {
    console.error('Update player error:', playerError);
    return false;
  }
  
  // 更新装备（先删除旧数据）
  await client
    .from('player_equipment')
    .delete()
    .eq('player_id', userId);
  
  // 收集所有装备记录
  const equipmentRecords: any[] = [];
  
  // 装备槽中的装备
  const equipmentSlots = player.equipmentSlots || [];
  for (let i = 0; i < equipmentSlots.length; i++) {
    const item = equipmentSlots[i];
    if (item.type === 'equipment') {
      const eq = item.item as Equipment;
      equipmentRecords.push({
        player_id: userId,
        equipment_id: eq.id,
        equipment_name: eq.name,
        quality: eq.quality,
        value: eq.totalValue,
        rarity: eq.description || '',
        stats: eq.affixes,
        is_looted: true,
        slot_type: 'equipment_slot',
        slot_index: i,
      });
    }
  }
  
  // 背包中的装备
  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    if (item.type === 'equipment') {
      const eq = item.item as Equipment;
      equipmentRecords.push({
        player_id: userId,
        equipment_id: eq.id,
        equipment_name: eq.name,
        quality: eq.quality,
        value: eq.totalValue,
        rarity: eq.description || '',
        stats: eq.affixes,
        is_looted: true,
        slot_type: 'inventory',
        slot_index: i,
      });
    }
  }
  
  // 保险箱中的装备
  const safeBox = player.safeBox || [];
  for (let i = 0; i < safeBox.length; i++) {
    const item = safeBox[i];
    if (item.type === 'equipment') {
      const eq = item.item as Equipment;
      equipmentRecords.push({
        player_id: userId,
        equipment_id: eq.id,
        equipment_name: eq.name,
        quality: eq.quality,
        value: eq.totalValue,
        rarity: eq.description || '',
        stats: eq.affixes,
        is_looted: true,
        slot_type: 'safebox',
        slot_index: i,
      });
    }
  }
  
  // 批量插入
  if (equipmentRecords.length > 0) {
    await client.from('player_equipment').insert(equipmentRecords);
  }
  
  // 更新道具
  await client
    .from('player_items')
    .delete()
    .eq('player_id', userId);
  
  if (player.items && player.items.length > 0) {
    const itemRecords = player.items.map((item: any) => ({
      player_id: userId,
      item_type: item.type,
      item_name: item.name,
      quantity: item.quantity,
      effect: item.effect,
      is_equipped: item.isEquipped || false,
    }));
    
    await client.from('player_items').insert(itemRecords);
  }
  
  return true;
}

// ==================== 排行榜 ====================

/**
 * 获取排行榜（公开数据，无需鉴权）
 */
export async function getLeaderboardData(): Promise<any[]> {
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
  
  return (data || []).map((item: any) => ({
    playerName: item.player_name,
    totalValue: item.total_value,
    killCount: item.kill_count,
    equipmentCount: item.equipment_count,
    survivedSeconds: item.survived_seconds,
    timestamp: new Date(item.created_at).getTime(),
  }));
}

/**
 * 添加排行榜记录
 */
export async function addLeaderboardRecord(
  userId: string,
  player: PlayerState,
  totalValue: number
): Promise<void> {
  const client = getSupabaseClient();
  
  // 计算存活时间
  const { data: playerData } = await client
    .from('players')
    .select('created_at')
    .eq('id', userId)
    .single();
  
  let survivedSeconds = 0;
  if (playerData) {
    const createdAt = new Date((playerData as any).created_at).getTime();
    survivedSeconds = Math.floor((Date.now() - createdAt) / 1000);
  }
  
  await client.from('leaderboard').insert({
    player_id: userId,
    player_name: player.name,
    total_value: totalValue,
    kill_count: player.killCount || 0,
    equipment_count: player.inventory.length,
    survived_seconds: survivedSeconds,
  });
}

// ==================== 广播 ====================

export function addBroadcast(broadcast: { type: string; message: string }): void {
  const broadcastMsg: BroadcastMessage = {
    id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: broadcast.type,
    message: broadcast.message,
    timestamp: Date.now(),
  };
  
  broadcastsCache.unshift(broadcastMsg);
  
  if (broadcastsCache.length > 50) {
    broadcastsCache.pop();
  }
}

export function getBroadcasts(): BroadcastMessage[] {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const validBroadcasts = broadcastsCache.filter(b => b.timestamp > fiveMinutesAgo);
  return validBroadcasts.slice(0, 20);
}

// ==================== 工具函数 ====================

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
  
  const playerState: PlayerState = {
    id: dbPlayer.id,
    name: dbPlayer.name,
    bind_email: dbPlayer.bind_email,
    google_id: dbPlayer.google_id,
    google_email: dbPlayer.google_email,
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
  
  // 计算玩家风格
  const styleTag = calculatePlayerStyle(playerState);
  const styleScore = calculateStyleScore(playerState);
  playerState.styleTag = styleTag;
  playerState.styleScore = styleScore;
  
  // 设置默认高光时刻
  if (!playerState.recentHighlights) {
    playerState.recentHighlights = [];
    if (playerState.maxProfit && playerState.maxProfit > 5000) {
      playerState.recentHighlights.push(`最高收益 ${playerState.maxProfit.toLocaleString()}`);
    }
    if (playerState.redDropCount && playerState.redDropCount > 0) {
      playerState.recentHighlights.push(`累计开红 ${playerState.redDropCount} 次`);
    }
  }
  
  return playerState;
}
