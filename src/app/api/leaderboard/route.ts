// 排行榜 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { 
  getLeaderboard, 
  getPlayerRank, 
  getCategoryLeaderboard,
  getPlayerRankHistory 
} from '@/lib/game/leaderboard-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // 获取用户ID（可选）
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    
    let data;
    
    if (category) {
      // 分类排行榜
      data = await getCategoryLeaderboard(category as any, limit);
    } else {
      // 主排行榜
      data = await getLeaderboard(type as any, limit);
    }
    
    // 获取当前用户排名（如果有）
    let userRank = null;
    if (userId) {
      userRank = await getPlayerRank(userId, type as any);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        rankings: data,
        userRank,
      },
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json({ success: false, error: '获取排行榜失败' }, { status: 500 });
  }
}
