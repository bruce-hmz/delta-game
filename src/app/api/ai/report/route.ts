// AI 战报生成 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData } from '@/lib/game/auth-service';
import { generateBattleReport } from '@/lib/ai';
import { AIBattleReportInput } from '@/lib/ai/types';

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
    const { result, events, totalRounds, zonesExplored, highlights } = body;

    // 获取玩家数据
    const player = await getPlayerData(userId);
    if (!player) {
      return NextResponse.json(
        { success: false, error: '玩家不存在' },
        { status: 404 }
      );
    }

    const input: AIBattleReportInput = {
      result: result || {
        success: false,
        finalValue: 0,
      },
      events: events || [],
      playerStyle: (player.styleTag || 'unknown') as any,
      playerName: player.name,
      totalRounds: totalRounds || 1,
      zonesExplored: zonesExplored || [],
      highlights: highlights || [],
    };

    const report = await generateBattleReport(input, undefined, { id: userId, name: player.name });

    return NextResponse.json({
      success: true,
      data: {
        report,
        generatedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('AI report generation error:', error);
    return NextResponse.json(
      { success: false, error: '战报生成失败' },
      { status: 500 }
    );
  }
}
