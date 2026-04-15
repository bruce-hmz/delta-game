// AI 事件生成 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData } from '@/lib/game/auth-service';
import { generateEvent } from '@/lib/ai';
import { AIEventInput } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  try {
    // 验证用户
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { zone, zoneName, carryValue, round, recentEvents } = body;

    // 获取玩家数据以确定风格
    const player = await getPlayerData(userId);
    const playerStyle = player?.styleTag || 'unknown';

    const input: AIEventInput = {
      zone: zone || 'normal',
      zoneName: zoneName || '废弃居民区',
      carryValue: carryValue || 0,
      round: round || 1,
      playerStyle: playerStyle as any,
      recentEvents: recentEvents || [],
    };

    // 传递玩家信息用于埋点
    const event = await generateEvent(input, undefined, { id: userId, name: player?.name });

    return NextResponse.json({
      success: true,
      data: {
        event,
        generatedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('AI event generation error:', error);
    return NextResponse.json(
      { success: false, error: '事件生成失败' },
      { status: 500 }
    );
  }
}
