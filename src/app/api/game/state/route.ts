// 获取游戏状态 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData } from '@/lib/game/auth-service';
import { getBroadcasts } from '@/lib/game/supabase-service';

export async function GET(request: NextRequest) {
  try {
    // 从 Header 获取 token
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证', needAuth: true },
        { status: 401 }
      );
    }
    
    // 获取玩家数据
    const player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在，请先初始化', requireInit: true },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        broadcasts: getBroadcasts(),
      },
    });
  } catch (error) {
    console.error('Get state error:', error);
    return NextResponse.json(
      { success: false, error: '获取状态失败' },
      { status: 500 }
    );
  }
}
