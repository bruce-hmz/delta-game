// 战报分享 API - 创建分享

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData } from '@/lib/game/auth-service';
import { createShareReport } from '@/lib/game/share-service';
import { ShareReportInput } from '@/lib/ai/types';

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
    const { result, finalValue, totalRounds, aiReport, playerStyle, zonesExplored } = body;

    // 获取玩家数据
    const player = await getPlayerData(userId);
    if (!player) {
      return NextResponse.json(
        { success: false, error: '玩家不存在' },
        { status: 404 }
      );
    }

    const input: ShareReportInput = {
      playerName: player.name,
      result: result || 'fail',
      finalValue: finalValue || 0,
      totalRounds: totalRounds || 1,
      aiReport: aiReport || {
        title: '任务完成',
        narrative: '本次行动已结束。',
        highlights: [],
        advisorComment: '',
      },
      playerStyle: playerStyle || player.styleTag || 'unknown',
      zonesExplored: zonesExplored || [],
    };

    const { shareCode, shareUrl } = await createShareReport(input);

    return NextResponse.json({
      success: true,
      data: {
        shareCode,
        shareUrl,
      },
    });
  } catch (error) {
    console.error('Share report error:', error);
    return NextResponse.json(
      { success: false, error: '分享失败' },
      { status: 500 }
    );
  }
}
