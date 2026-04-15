// 用户认证 API - 支持匿名登录和昵称密码登录

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { v4 as uuidv4 } from 'uuid';
import { loginWithNickname, loginWithEmail } from '@/lib/game/auth-service';

// 简单的 token 验证（基于 UUID）
function validateToken(token: string): string | null {
  // Token 格式: userId.timestamp.signature
  // 简化版：直接返回 userId
  try {
    const parts = token.split('.');
    if (parts.length >= 1) {
      return parts[0];
    }
    return null;
  } catch {
    return null;
  }
}

// 生成 token
function generateToken(userId: string): string {
  const timestamp = Date.now();
  const signature = Buffer.from(`${userId}:${timestamp}`).toString('base64').slice(0, 16);
  return `${userId}.${timestamp}.${signature}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId: providedUserId, nickname, password, email } = body;
    
    // 支持邮箱+密码登录
    if (email && password) {
      const result = await loginWithEmail(email, password);
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      
      const token = generateToken(result.userId!);
      return NextResponse.json({
        success: true,
        data: {
          userId: result.userId,
          accessToken: token,
          isNewUser: false,
          hasNickname: true,
          player: result.player,
        },
      });
    }
    
    // 支持昵称+密码登录
    if (nickname && password) {
      const result = await loginWithNickname(nickname, password);
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      
      const token = generateToken(result.userId!);
      return NextResponse.json({
        success: true,
        data: {
          userId: result.userId,
          accessToken: token,
          isNewUser: false,
          hasNickname: true,
          player: result.player,
        },
      });
    }
    
    const client = getSupabaseClient();
    
    // 如果提供了 userId，检查是否存在
    if (providedUserId) {
      const { data: existingPlayer } = await client
        .from('players')
        .select('id, name')
        .eq('id', providedUserId)
        .single();
      
      if (existingPlayer) {
        // 用户存在，返回 token
        const token = generateToken(providedUserId);
        return NextResponse.json({
          success: true,
          data: {
            userId: providedUserId,
            accessToken: token,
            isNewUser: false,
            hasNickname: !!existingPlayer.name,
          },
        });
      }
    }
    
    // 创建新用户
    const newUserId = uuidv4();
    const token = generateToken(newUserId);
    
    // 不在这里创建 players 记录，等用户设置昵称时再创建
    return NextResponse.json({
      success: true,
      data: {
        userId: newUserId,
        accessToken: token,
        isNewUser: true,
        hasNickname: false,
      },
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '认证失败' },
      { status: 500 }
    );
  }
}

// 验证 token 并获取用户信息
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证' },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userId = validateToken(token);
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '无效的身份凭证' },
        { status: 401 }
      );
    }
    
    const client = getSupabaseClient();
    
    const { data: player } = await client
      .from('players')
      .select('id, name')
      .eq('id', userId)
      .single();
    
    return NextResponse.json({
      success: true,
      data: {
        userId,
        hasNickname: !!player?.name,
      },
    });
  } catch (error: any) {
    console.error('Verify token error:', error);
    return NextResponse.json(
      { success: false, error: '验证失败' },
      { status: 500 }
    );
  }
}
