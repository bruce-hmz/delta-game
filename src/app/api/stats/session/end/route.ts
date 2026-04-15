import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 结束游戏会话
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userId = token.split('.')[0];
    
    const body = await request.json();
    const { sessionId, finalValue, extracted, died, zone, eventsCount } = body;
    
    if (!sessionId) {
      return NextResponse.json({ success: false, error: '缺少会话ID' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 获取会话信息
    const { data: session, error: sessionError } = await client
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('player_id', userId)
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    }
    
    // 计算时长
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    // 更新会话记录
    const { error: updateError } = await client
      .from('game_sessions')
      .update({
        end_time: endTime.toISOString(),
        duration_seconds: durationSeconds,
        final_value: finalValue || 0,
        extracted: extracted || false,
        died: died || false,
        zone: zone || null,
        events_count: eventsCount || 0,
      })
      .eq('id', sessionId);
    
    if (updateError) {
      console.error('Failed to update session:', updateError);
    }
    
    // 更新玩家总游戏时长和会话数
    const { data: player } = await client
      .from('players')
      .select('total_play_seconds, session_count')
      .eq('id', userId)
      .single();
    
    if (player) {
      await client
        .from('players')
        .update({
          total_play_seconds: (player.total_play_seconds || 0) + durationSeconds,
          session_count: (player.session_count || 0) + 1,
        })
        .eq('id', userId);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        durationSeconds,
        sessionId,
      },
    });
    
  } catch (error: any) {
    console.error('End session error:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
