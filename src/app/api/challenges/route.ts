// 每日挑战 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { getDailyChallenges, claimChallengeReward } from '@/lib/game/challenge-service';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const challenges = await getDailyChallenges(userId);
    
    return NextResponse.json({
      success: true,
      data: challenges,
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    return NextResponse.json({ success: false, error: '获取挑战失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ success: false, error: '缺少挑战代码' }, { status: 400 });
    }

    const reward = await claimChallengeReward(userId, code);
    
    return NextResponse.json({
      success: true,
      data: reward,
    });
  } catch (error) {
    console.error('Claim challenge error:', error);
    return NextResponse.json({ success: false, error: '领取失败' }, { status: 400 });
  }
}
