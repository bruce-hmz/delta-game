import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取游戏统计数据
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    
    // 获取总玩家数
    const { count: totalPlayers } = await client
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    // 获取今日新增玩家
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayNewPlayers } = await client
      .from('players')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    // 获取总游戏会话数
    const { count: totalSessions } = await client
      .from('game_sessions')
      .select('*', { count: 'exact', head: true });
    
    // 获取今日游戏会话数
    const { count: todaySessions } = await client
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', today.toISOString());
    
    // 获取平均游戏时长
    const { data: avgDuration } = await client
      .from('game_sessions')
      .select('duration_seconds')
      .not('duration_seconds', 'is', null)
      .gt('duration_seconds', 0);
    
    let avgPlayTime = 0;
    if (avgDuration && avgDuration.length > 0) {
      const total = avgDuration.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      avgPlayTime = Math.round(total / avgDuration.length);
    }
    
    // 获取总游戏时长
    const { data: totalDuration } = await client
      .from('players')
      .select('total_play_seconds');
    
    let totalPlayTime = 0;
    if (totalDuration) {
      totalPlayTime = totalDuration.reduce((sum, p) => sum + (p.total_play_seconds || 0), 0);
    }
    
    // 获取成功撤离次数
    const { count: extractedCount } = await client
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('extracted', true);
    
    // 获取死亡次数
    const { count: diedCount } = await client
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('died', true);
    
    // 获取最近活跃玩家（最近24小时）
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: activePlayers24h } = await client
      .from('game_sessions')
      .select('player_id', { count: 'exact', head: true })
      .gte('start_time', yesterday.toISOString());
    
    // 获取最近7天每日活跃玩家数
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const { count } = await client
        .from('game_sessions')
        .select('player_id', { count: 'exact', head: true })
        .gte('start_time', date.toISOString())
        .lt('start_time', nextDate.toISOString());
      
      last7Days.push({
        date: date.toISOString().split('T')[0],
        sessions: count || 0,
      });
    }
    
    // 获取排行榜 Top 5（按总价值）
    const { data: topPlayers } = await client
      .from('players')
      .select('name, total_loot_value, total_play_seconds, session_count')
      .order('total_loot_value', { ascending: false })
      .limit(5);
    
    return NextResponse.json({
      success: true,
      data: {
        players: {
          total: totalPlayers || 0,
          todayNew: todayNewPlayers || 0,
          active24h: activePlayers24h || 0,
        },
        sessions: {
          total: totalSessions || 0,
          today: todaySessions || 0,
          extracted: extractedCount || 0,
          died: diedCount || 0,
        },
        playTime: {
          total: totalPlayTime,
          avg: avgPlayTime,
          formatted: {
            total: formatDuration(totalPlayTime),
            avg: formatDuration(avgPlayTime),
          },
        },
        last7Days,
        topPlayers: topPlayers || [],
      },
    });
    
  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// 格式化时长
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0分钟';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}
