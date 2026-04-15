// 获取排行榜 API

import { NextResponse } from 'next/server';
import { getLeaderboardData } from '@/lib/game/auth-service';

export async function GET() {
  try {
    const leaderboard = await getLeaderboardData();
    
    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
      },
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: '获取排行榜失败' },
      { status: 500 }
    );
  }
}
