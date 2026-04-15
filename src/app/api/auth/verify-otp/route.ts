import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { v4 as uuidv4 } from 'uuid';

// 生成 token
function generateToken(userId: string): string {
  const timestamp = Date.now();
  const signature = Buffer.from(`${userId}:${timestamp}`).toString('base64').slice(0, 16);
  return `${userId}.${timestamp}.${signature}`;
}

// 验证邮箱验证码并登录/注册
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;
    
    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: '请输入邮箱和验证码' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    const normalizedEmail = email.toLowerCase().trim();
    
    // 查找有效的验证码
    const { data: codeRecord, error: queryError } = await client
      .from('email_verification_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', otp)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (queryError || !codeRecord) {
      return NextResponse.json(
        { success: false, error: '验证码错误或已过期' },
        { status: 400 }
      );
    }
    
    // 标记验证码已使用
    await client
      .from('email_verification_codes')
      .update({ used: true })
      .eq('id', codeRecord.id);
    
    // 检查是否已有绑定此邮箱的玩家
    const { data: existingPlayer } = await client
      .from('players')
      .select('*')
      .eq('bind_email', normalizedEmail)
      .single();
    
    if (existingPlayer) {
      // 已存在，更新登录时间
      await client
        .from('players')
        .update({ last_login: new Date().toISOString() })
        .eq('id', existingPlayer.id);
      
      const token = generateToken(existingPlayer.id);
      
      return NextResponse.json({
        success: true,
        data: {
          userId: existingPlayer.id,
          accessToken: token,
          isNewUser: false,
          player: existingPlayer,
        },
      });
    }
    
    // 新用户，创建账号
    const newUserId = uuidv4();
    const defaultName = normalizedEmail.split('@')[0];
    
    const { error: insertError } = await client
      .from('players')
      .insert({
        id: newUserId,
        name: defaultName,
        bind_email: normalizedEmail,
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
        created_at: new Date().toISOString(),
      });
    
    if (insertError) {
      console.error('Failed to create player:', insertError);
      return NextResponse.json(
        { success: false, error: '创建账号失败，请重试' },
        { status: 500 }
      );
    }
    
    // 获取新创建的玩家数据
    const { data: newPlayer } = await client
      .from('players')
      .select('*')
      .eq('id', newUserId)
      .single();
    
    const token = generateToken(newUserId);
    
    return NextResponse.json({
      success: true,
      data: {
        userId: newUserId,
        accessToken: token,
        isNewUser: true,
        player: newPlayer,
      },
    });
    
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: '验证失败，请重试' },
      { status: 500 }
    );
  }
}
