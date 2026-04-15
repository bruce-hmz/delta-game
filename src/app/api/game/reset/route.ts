// 重置游戏 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData } from '@/lib/game/auth-service';

export async function POST(request: NextRequest) {
  try {
    // 从 Header 获取 token
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证', needAuth: true },
        { status: 401 }
      );
    }
    
    // 获取玩家
    const player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在，请先初始化', requireInit: true },
        { status: 404 }
      );
    }
    
    // 重置玩家状态，保留金币和道具
    player.isAlive = true;
    player.currentHp = player.maxHp;
    player.inventory = [];
    // 保留道具和金币
    player.currentZone = 'safe';
    player.killCount = 0;
    player.currentRound = 0;
    player.winStreak = 0;
    player.failStreak = 0;
    player.noDropStreak = 0;
    player.redDropCount = 0;
    
    await updatePlayerData(userId, player);
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        message: '游戏已重置，祝你好运！',
      },
    });
  } catch (error) {
    console.error('Reset game error:', error);
    return NextResponse.json(
      { success: false, error: '重置失败' },
      { status: 500 }
    );
  }
}
