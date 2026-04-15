// 玩家记忆 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { getPlayerMemory, generatePlayerSummary, syncPlayerMemoryFromRuns } from '@/lib/game/player-memory-service';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'full';
    
    if (type === 'summary') {
      const summary = await generatePlayerSummary(userId);
      return NextResponse.json({ success: true, data: summary });
    }
    
    const memory = await getPlayerMemory(userId);
    
    return NextResponse.json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error('Get player memory error:', error);
    return NextResponse.json({ success: false, error: '获取玩家记忆失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const { action } = await request.json();
    
    if (action === 'sync') {
      await syncPlayerMemoryFromRuns(userId);
      return NextResponse.json({ success: true, message: '同步完成' });
    }
    
    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('Player memory action error:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
