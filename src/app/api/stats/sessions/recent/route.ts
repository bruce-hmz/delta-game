import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取最近的游戏会话
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // 先检查 game_sessions 表是否存在
    const { error: tableCheckError } = await client
      .from('game_sessions')
      .select('id')
      .limit(1);
    
    // 如果表不存在或查询出错，返回空数据
    if (tableCheckError) {
      console.log('game_sessions table may not exist yet:', tableCheckError.message);
      return NextResponse.json({
        success: true,
        data: [],
        message: '暂无会话数据，请先开始游戏'
      });
    }
    
    // 获取最近的会话
    const { data: sessions, error } = await client
      .from('game_sessions')
      .select(`
        id,
        player_id,
        start_time,
        end_time,
        duration_seconds,
        final_value,
        extracted,
        died,
        zone,
        events_count
      `)
      .order('start_time', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Fetch sessions error:', error);
      return NextResponse.json({ success: false, error: '获取会话数据失败' }, { status: 500 });
    }
    
    // 如果没有会话数据，直接返回空数组
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '暂无会话数据'
      });
    }
    
    // 获取所有涉及的玩家ID
    const playerIds = [...new Set(sessions.map(s => s.player_id))];
    
    // 查询玩家名称
    const { data: players } = await client
      .from('players')
      .select('id, name')
      .in('id', playerIds);
    
    // 创建玩家ID到名称的映射
    const playerNameMap: Record<string, string> = {};
    players?.forEach(p => {
      playerNameMap[p.id] = p.name;
    });
    
    // 转换数据格式
    const formattedSessions = sessions.map((s: any) => ({
      id: s.id,
      player_id: s.player_id,
      player_name: playerNameMap[s.player_id] || '未知玩家',
      start_time: s.start_time,
      end_time: s.end_time,
      duration_seconds: s.duration_seconds,
      final_value: s.final_value || 0,
      extracted: s.extracted || false,
      died: s.died || false,
      zone: s.zone,
      events_count: s.events_count || 0,
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedSessions,
    });
    
  } catch (error: any) {
    console.error('Recent sessions error:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
