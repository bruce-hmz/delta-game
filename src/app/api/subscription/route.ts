// 会员订阅 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { 
  getSubscriptionTiers, 
  getPlayerSubscription, 
  getPlayerBenefitsSummary,
  SUBSCRIPTION_TIERS 
} from '@/lib/game/subscription-service';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'info';
    
    // 获取会员等级列表
    if (type === 'tiers') {
      const tiers = await getSubscriptionTiers();
      return NextResponse.json({ success: true, data: tiers });
    }
    
    // 需要用户认证
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    
    // 获取玩家订阅信息
    if (type === 'info') {
      const subscription = await getPlayerSubscription(userId);
      return NextResponse.json({ success: true, data: subscription });
    }
    
    // 获取玩家权益摘要
    if (type === 'benefits') {
      const benefits = await getPlayerBenefitsSummary(userId);
      return NextResponse.json({ success: true, data: benefits });
    }
    
    return NextResponse.json({ success: false, error: '未知类型' }, { status: 400 });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
