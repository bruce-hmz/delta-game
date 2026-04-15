// 会员订阅服务

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

// 会员特征类型
export type SubscriptionFeatures = {
  aiAdviceLimit: number;
  storageSlots: number;
  equipmentSlots: number;
  dailyChallenges: number;
  chatSupport: boolean;
  skinOptions: number;
  extractProtection: number;
  exclusiveEvents: boolean;
  priorityQueue: boolean;
  vipBadge: boolean;
};

// 会员等级类型
export type SubscriptionTier = {
  code: string;
  name: string;
  description: string;
  price?: number;
  priceMonthly?: number;
  durationDays?: number;
  features: SubscriptionFeatures;
  icon: string;
  color: string;
  displayOrder: number;
};

// 会员等级代码
export type TierCode = 'free' | 'basic' | 'premium' | 'vip';

// 会员等级定义
export const SUBSCRIPTION_TIERS: Record<TierCode, SubscriptionTier> = {
  free: {
    code: 'free',
    name: '免费用户',
    description: '基础游戏体验',
    features: {
      aiAdviceLimit: 5,        // 每日AI建议次数限制
      storageSlots: 50,         // 仓库格子数
      equipmentSlots: 10,       // 装备槽数量
      dailyChallenges: 3,       // 每日挑战数量
      chatSupport: false,        // 客服支持
      skinOptions: 1,           // 皮肤选项
      extractProtection: 0,      // 撤离保护次数
      exclusiveEvents: false,   // 专属活动
      priorityQueue: false,      // 优先队列
      vipBadge: false,           // VIP徽章
    },
    icon: '👤',
    color: '#888888',
    displayOrder: 0,
  },
  basic: {
    code: 'basic',
    name: '基础会员',
    description: '提升游戏体验',
    price: 3000,
    priceMonthly: 300,
    durationDays: 30,
    features: {
      aiAdviceLimit: 20,
      storageSlots: 200,
      equipmentSlots: 15,
      dailyChallenges: 5,
      chatSupport: false,
      skinOptions: 3,
      extractProtection: 1,
      exclusiveEvents: false,
      priorityQueue: false,
      vipBadge: false,
    },
    icon: '⭐',
    color: '#4CAF50',
    displayOrder: 1,
  },
  premium: {
    code: 'premium',
    name: '高级会员',
    description: '尊贵游戏特权',
    price: 8000,
    priceMonthly: 800,
    durationDays: 30,
    features: {
      aiAdviceLimit: -1,        // -1 表示无限制
      storageSlots: 500,
      equipmentSlots: 20,
      dailyChallenges: 8,
      chatSupport: true,
      skinOptions: 10,
      extractProtection: 3,
      exclusiveEvents: true,
      priorityQueue: false,
      vipBadge: true,
    },
    icon: '💎',
    color: '#9C27B0',
    displayOrder: 2,
  },
  vip: {
    code: 'vip',
    name: 'VIP会员',
    description: '极致游戏体验',
    price: 20000,
    priceMonthly: 2000,
    durationDays: 30,
    features: {
      aiAdviceLimit: -1,
      storageSlots: 1000,
      equipmentSlots: 30,
      dailyChallenges: 10,
      chatSupport: true,
      skinOptions: -1,
      extractProtection: 5,
      exclusiveEvents: true,
      priorityQueue: true,
      vipBadge: true,
    },
    icon: '👑',
    color: '#FFD700',
    displayOrder: 3,
  },
};

// 获取会员等级列表
export async function getSubscriptionTiers() {
  // 如果没有数据库连接，返回默认定义
  const db = getSupabase();
  if (!db) {
    return Object.values(SUBSCRIPTION_TIERS);
  }
  
  const { data, error } = await db
    .from('subscription_tiers')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  
  if (error || !data) {
    // 如果数据库没有，返回默认定义
    return Object.values(SUBSCRIPTION_TIERS);
  }
  
  return data?.map(t => ({
    ...t,
    features: typeof t.features === 'string' ? JSON.parse(t.features) : t.features,
  }));
}

// 获取玩家订阅信息
export async function getPlayerSubscription(playerId: string) {
  const db = getSupabase();
  if (!db) {
    return {
      tierCode: 'free',
      status: 'inactive',
      tier: SUBSCRIPTION_TIERS.free,
    };
  }
  
  const { data, error } = await db
    .from('player_subscriptions')
    .select('*')
    .eq('player_id', playerId)
    .single();
  
  if (error || !data) {
    // 返回免费用户
    return {
      tierCode: 'free',
      status: 'inactive',
      tier: SUBSCRIPTION_TIERS.free,
    };
  }
  
  // 检查是否过期
  const tier = SUBSCRIPTION_TIERS[data.tier_code as TierCode] || SUBSCRIPTION_TIERS.free;
  const isExpired = data.expire_at && new Date(data.expire_at) < new Date();
  
  if (isExpired && data.status === 'active') {
    // 自动更新为过期状态
    await db
      .from('player_subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', data.id);
    
    return {
      ...data,
      status: 'expired',
      tier: SUBSCRIPTION_TIERS.free,
    };
  }
  
  return {
    ...data,
    tier,
  };
}

// 计算玩家权益
export function calculatePlayerBenefits(tierCode: TierCode) {
  const tier = SUBSCRIPTION_TIERS[tierCode] || SUBSCRIPTION_TIERS.free;
  return tier.features;
}

// 检查是否有某项权益
export function hasFeature(playerId: string, tierCode: TierCode, feature: string): boolean {
  const features = calculatePlayerBenefits(tierCode);
  const value = features[feature as keyof typeof features];
  
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return false;
}

// 获取功能限制值
export function getFeatureLimit(tierCode: TierCode, feature: string): number {
  const features = calculatePlayerBenefits(tierCode);
  const value = features[feature as keyof typeof features];
  if (typeof value === 'number') return value;
  return 0;
}

// 升级会员
export async function upgradeSubscription(
  playerId: string,
  tierCode: TierCode,
  durationDays: number = 30
) {
  const tier = SUBSCRIPTION_TIERS[tierCode];
  if (!tier) throw new Error('Invalid tier');
  
  const db = getSupabase();
  if (!db) {
    return { success: true, tier, expireAt: new Date() };
  }
  
  const now = new Date();
  const expireAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  
  // 获取当前订阅
  const { data: existing } = await db
    .from('player_subscriptions')
    .select('*')
    .eq('player_id', playerId)
    .single();
  
  if (existing) {
    // 更新订阅
    const newStartAt = existing.status === 'active' && existing.expire_at && new Date(existing.expire_at) > now
      ? new Date(existing.expire_at)
      : now;
    const newExpireAt = new Date(newStartAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    
    await db
      .from('player_subscriptions')
      .update({
        tier_code: tierCode,
        status: 'active',
        start_at: newStartAt.toISOString(),
        expire_at: newExpireAt.toISOString(),
        total_days: existing.total_days + durationDays,
        updated_at: now.toISOString(),
      })
      .eq('player_id', playerId);
  } else {
    // 创建新订阅
    await db.from('player_subscriptions').insert({
      player_id: playerId,
      tier_code: tierCode,
      status: 'active',
      start_at: now.toISOString(),
      expire_at: expireAt.toISOString(),
      total_days: durationDays,
    });
  }
  
  return { success: true, tier, expireAt };
}

// 取消订阅
export async function cancelSubscription(playerId: string) {
  const db = getSupabase();
  if (!db) {
    return { success: true };
  }
  
  await db
    .from('player_subscriptions')
    .update({
      auto_renew: false,
      updated_at: new Date().toISOString(),
    })
    .eq('player_id', playerId);
  
  return { success: true };
}

// 获取购买记录
export async function getPurchaseHistory(playerId: string, limit: number = 10) {
  const db = getSupabase();
  if (!db) {
    return [];
  }
  
  const { data, error } = await db
    .from('subscription_orders')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  
  return data?.map(order => ({
    ...order,
    tier: SUBSCRIPTION_TIERS[order.tier_code as TierCode],
  }));
}

// 创建订单
export async function createOrder(
  playerId: string,
  tierCode: TierCode,
  actualPrice: number,
  paymentMethod?: string
) {
  const db = getSupabase();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const orderNo = `SUB${Date.now()}${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
  
  const { data, error } = await db
    .from('subscription_orders')
    .insert({
      player_id: playerId,
      order_no: orderNo,
      tier_code: tierCode,
      original_price: SUBSCRIPTION_TIERS[tierCode]?.price || 0,
      actual_price: actualPrice,
      payment_method: paymentMethod,
      payment_status: 'pending',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// 支付成功
export async function completePayment(orderNo: string) {
  const db = getSupabase();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const { data: order } = await db
    .from('subscription_orders')
    .select('*')
    .eq('order_no', orderNo)
    .single();
  
  if (!order) throw new Error('Order not found');
  
  // 更新订单状态
  await db
    .from('subscription_orders')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('order_no', orderNo);
  
  // 激活订阅
  const durationDays = SUBSCRIPTION_TIERS[order.tier_code as TierCode]?.durationDays || 30;
  await upgradeSubscription(order.player_id, order.tier_code as TierCode, durationDays);
  
  return { success: true };
}

// 获取玩家权益摘要（用于前端显示）
export async function getPlayerBenefitsSummary(playerId: string) {
  const subscription = await getPlayerSubscription(playerId);
  const tier = subscription.tier || SUBSCRIPTION_TIERS.free;
  
  return {
    tierCode: tier.code,
    tierName: tier.name,
    tierIcon: tier.icon,
    tierColor: tier.color,
    isActive: subscription.status === 'active',
    expireAt: subscription.expireAt,
    features: tier.features,
    benefits: [
      { label: 'AI建议次数', value: tier.features.aiAdviceLimit === -1 ? '无限' : `${tier.features.aiAdviceLimit}/日` },
      { label: '仓库容量', value: tier.features.storageSlots },
      { label: '装备槽', value: tier.features.equipmentSlots },
      { label: '每日挑战', value: tier.features.dailyChallenges },
      { label: '撤离保护', value: tier.features.extractProtection > 0 ? `${tier.features.extractProtection}次/日` : '无' },
      { label: 'VIP徽章', value: tier.features.vipBadge ? '✓' : '✗' },
    ],
  };
}
