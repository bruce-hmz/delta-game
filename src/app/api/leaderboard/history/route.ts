// 排行榜历史 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { getPlayerRankHistory } from '@/lib/game/leaderboard-service';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'weekly';
    
    const history = await getPlayerRankHistory(userId, period);
    
    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get rank history error:', error);
    return NextResponse.json({ success: false, error: '获取排名历史失败' }, { status: 500 });
  }
}
