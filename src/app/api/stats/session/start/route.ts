import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { v4 as uuidv4 } from 'uuid';

// 开始游戏会话
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Session Start] No auth header');
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userId = token.split('.')[0];
    
    console.log('[Session Start] Token:', token.substring(0, 50) + '...');
    console.log('[Session Start] Parsed userId:', userId);
    
    const client = getSupabaseClient();
    
    // 获取玩家信息
    const { data: player, error: playerError } = await client
      .from('players')
      .select('id, name')
      .eq('id', userId)
      .single();
    
    console.log('[Session Start] Player query:', { player, error: playerError?.message });
    
    // 如果玩家不存在，静默失败但不阻塞游戏
    if (playerError || !player) {
      console.log('[Session Start] Player not found, creating player record...');
      
      // 使用基于时间戳和随机数的唯一名字，避免名字冲突
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 6);
      const uniqueName = `玩家${timestamp}${randomPart}`;
      
      // 尝试创建玩家记录（如果用户之前跳过了设置昵称）
      const { data: newPlayer, error: createError } = await client
        .from('players')
        .insert({
          id: userId,
          name: uniqueName,
          coins: 2000,
          is_alive: true,
          current_hp: 100,
          max_hp: 100,
          current_zone: 'safe',
          game_status: 'exploring',
          kill_count: 0,
          total_loot_value: 0,
          red_count: 0,
          max_profit: 0,
          total_games: 0,
        })
        .select()
        .single();
      
      if (createError) {
        console.log('[Session Start] Failed to create player:', createError.message);
        // 即使创建失败，也尝试创建会话（会话追踪可以稍后补）
        const sessionId = uuidv4();
        const { error: sessionError } = await client
          .from('game_sessions')
          .insert({
            id: sessionId,
            player_id: userId,
            start_time: new Date().toISOString(),
          });
        
        if (sessionError) {
          console.error('[Session Start] Failed to create session:', sessionError);
        }
        
        return NextResponse.json({
          success: true,
          data: { sessionId: sessionError ? null : sessionId, message: '玩家记录创建失败，会话已记录' },
        });
      }
      
      console.log('[Session Start] Player created:', newPlayer);
    }
    
    // 创建新会话
    const sessionId = uuidv4();
    const { error: insertError } = await client
      .from('game_sessions')
      .insert({
        id: sessionId,
        player_id: userId,
        start_time: new Date().toISOString(),
      });
    
    if (insertError) {
      console.error('[Session Start] Failed to create session:', insertError);
      return NextResponse.json({ success: false, error: `创建会话失败: ${insertError.message}` }, { status: 500 });
    }
    
    console.log('[Session Start] Session created:', sessionId);
    
    return NextResponse.json({
      success: true,
      data: { sessionId },
    });
    
  } catch (error: any) {
    console.error('[Session Start] Error:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
