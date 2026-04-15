// 领取成就奖励 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { claimAchievementReward } from '@/lib/game/achievement-service';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ success: false, error: '缺少成就代码' }, { status: 400 });
    }

    const reward = await claimAchievementReward(userId, code);
    
    return NextResponse.json({
      success: true,
      data: reward,
    });
  } catch (error) {
    console.error('Claim achievement error:', error);
    return NextResponse.json({ success: false, error: '领取失败' }, { status: 400 });
  }
}
