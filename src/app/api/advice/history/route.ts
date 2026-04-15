// AI 建议历史 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { getAdviceHistory, getAdviceStats, generateHistorySummary } from '@/lib/game/advice-history-service';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'history';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (type === 'stats') {
      const stats = await getAdviceStats(userId);
      return NextResponse.json({ success: true, data: stats });
    }
    
    if (type === 'summary') {
      const summary = await generateHistorySummary(userId);
      return NextResponse.json({ success: true, data: { summary } });
    }
    
    const history = await getAdviceHistory(userId, limit);
    
    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get advice history error:', error);
    return NextResponse.json({ success: false, error: '获取建议历史失败' }, { status: 500 });
  }
}
