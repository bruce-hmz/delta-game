// 用户初始化 API - 检查用户状态，设置昵称和密码

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, checkUserExists, initializeUser } from '@/lib/game/auth-service';
import { getBroadcasts } from '@/lib/game/supabase-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    // 从 Header 获取 token
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证', needAuth: true },
        { status: 401 }
      );
    }
    
    // 检查用户是否已存在
    const result = await checkUserExists(userId);
    
    if (result.exists) {
      return NextResponse.json({
        success: true,
        data: {
          exists: true,
          player: result.player,
          broadcasts: getBroadcasts(),
          message: `代号确认，欢迎进入战区`,
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        exists: false,
        message: '请输入你的行动代号（昵称）',
      },
    });
  } catch (error) {
    console.error('Check user error:', error);
    return NextResponse.json(
      { success: false, error: '检查用户状态失败' },
      { status: 500 }
    );
  }
}

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
    
    const body = await request.json();
    const { nickname, password, isGuest } = body;
    
    if (!nickname) {
      return NextResponse.json(
        { success: false, error: '请输入昵称' },
        { status: 400 }
      );
    }
    
    // 初始化用户
    const result = await initializeUser(userId, nickname, password, isGuest);
    
    if (!result.success) {
      // 昵称已存在，需要登录
      if (result.needLogin) {
        return NextResponse.json({
          success: false,
          error: result.error,
          needLogin: true,
        });
      }
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    // 初始化成功后，创建游戏 session
    if (result.player) {
      try {
        const client = getSupabaseClient();
        const sessionId = uuidv4();
        await client.from('game_sessions').insert({
          id: sessionId,
          player_id: userId,
          start_time: new Date().toISOString(),
        });
        console.log('[Init] Session created for new user:', sessionId);
      } catch (sessionError) {
        console.error('[Init] Failed to create session:', sessionError);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        player: result.player,
        broadcasts: getBroadcasts(),
        message: `代号确认，欢迎进入战区，${nickname}！`,
      },
    });
  } catch (error) {
    console.error('Initialize user error:', error);
    return NextResponse.json(
      { success: false, error: '初始化用户失败' },
      { status: 500 }
    );
  }
}
