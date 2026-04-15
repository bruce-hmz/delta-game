// 开始新游戏 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData } from '@/lib/game/auth-service';
import { getBroadcasts } from '@/lib/game/supabase-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { v4 as uuidv4 } from 'uuid';

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
    
    // 获取玩家数据
    let player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在，请先初始化', requireInit: true },
        { status: 404 }
      );
    }
    
    // 如果玩家已死亡，重置状态
    if (!player.isAlive) {
      player.isAlive = true;
      player.currentHp = player.maxHp;
      player.inventory = [];
      player.currentZone = 'safe';
      player.killCount = 0;
      player.currentRound = 0;
      player.winStreak = 0;
      player.failStreak = 0;
      player.noDropStreak = 0;
      
      await updatePlayerData(userId, player);
    }
    
    // 自动创建游戏会话（后端保证）
    const sessionId = uuidv4();
    try {
      const client = getSupabaseClient();
      await client.from('game_sessions').insert({
        id: sessionId,
        player_id: userId,
        start_time: new Date().toISOString(),
      });
      console.log('[Start Game] Session created:', sessionId);
    } catch (error) {
      console.error('[Start Game] Failed to create session:', error);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        broadcasts: getBroadcasts(),
        sessionId, // 返回 sessionId 供前端使用
      },
    });
  } catch (error) {
    console.error('Start game error:', error);
    return NextResponse.json(
      { success: false, error: '游戏启动失败' },
      { status: 500 }
    );
  }
}
