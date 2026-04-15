// AI 战术建议 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData } from '@/lib/game/auth-service';
import { generateTacticalAdvice } from '@/lib/ai';
import { AITacticalInput } from '@/lib/ai/types';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { generateHistorySummary } from '@/lib/game/advice-history-service';
import { recordAIAdvice } from '@/lib/game/advice-history-service';

export async function POST(request: NextRequest) {
  try {
    // 提取请求头用于 AI 调用
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 验证用户
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { zone, zoneName, carryValue, round, buffs, runId } = body;

    // 获取玩家数据
    const player = await getPlayerData(userId);
    if (!player) {
      return NextResponse.json(
        { success: false, error: '玩家不存在' },
        { status: 404 }
      );
    }

    // 获取历史建议摘要（S5: AI 引用历史建议）
    const historySummary = await generateHistorySummary(userId);

    const input: AITacticalInput = {
      zone: zone || 'normal',
      zoneName: zoneName || '废弃居民区',
      carryValue: carryValue || 0,
      round: round || 1,
      playerStyle: (player.styleTag || 'unknown') as any,
      buffs: buffs || {
        deathRateReduction: 0,
        redDropBoost: 0,
        extractBoost: 0,
        combatBoost: 0,
      },
      recentPerformance: {
        winStreak: player.winStreak || 0,
        failStreak: player.failStreak || 0,
        recentDeathRate: player.totalGames && player.totalGames > 0 
          ? (player.failStreak || 0) / player.totalGames 
          : 0,
      },
      historyHighlights: player.recentHighlights || [],
      // S5: 注入历史建议上下文
      historyAdviceSummary: historySummary,
    };

    const advice = await generateTacticalAdvice(input, customHeaders, { id: userId, name: player.name });

    // 记录建议到历史（S5: AI 引用历史建议）
    await recordAIAdvice(userId, {
      runId,
      round: round || 1,
      zone: zone || 'normal',
      carryValue: carryValue || 0,
      adviceText: advice.advice,
      recommendation: advice.recommendation,
      personality: advice.personality,
    });

    return NextResponse.json({
      success: true,
      data: {
        advice,
        generatedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('AI advice generation error:', error);
    return NextResponse.json(
      { success: false, error: '建议生成失败' },
      { status: 500 }
    );
  }
}
