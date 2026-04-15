// 成就系统 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { getPlayerAchievements, claimAchievementReward } from '@/lib/game/achievement-service';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const achievements = await getPlayerAchievements(userId);
    
    return NextResponse.json({
      success: true,
      data: achievements,
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    return NextResponse.json({ success: false, error: '获取成就失败' }, { status: 500 });
  }
}
