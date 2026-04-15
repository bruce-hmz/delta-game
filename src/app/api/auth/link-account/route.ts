// 账号升级 API - 直接绑定邮箱密码（不依赖 Supabase Auth）

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';
import { hashPassword } from '@/lib/game/auth-service';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证', needAuth: true },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    // 从 token 中提取 userId
    const parts = token.split('.');
    const userId = parts[0];
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '无效的身份凭证' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { email, password } = body;
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: '请输入有效的邮箱地址' },
        { status: 400 }
      );
    }
    
    // 验证密码强度
    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码长度至少为6个字符' },
        { status: 400 }
      );
    }
    
    const { url, anonKey } = getSupabaseCredentials();
    const client = createClient(url, anonKey, {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    // 检查邮箱是否已被绑定
    const { data: existingUser } = await client
      .from('players')
      .select('id, name')
      .eq('bind_email', email.toLowerCase())
      .single();
    
    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { success: false, error: '该邮箱已被其他账号绑定' },
        { status: 400 }
      );
    }
    
    // 检查当前用户是否存在
    const { data: currentPlayer } = await client
      .from('players')
      .select('id, name')
      .eq('id', userId)
      .single();
    
    if (!currentPlayer) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 400 }
      );
    }
    
    // 生成密码 hash
    const passwordHash = hashPassword(password);
    
    // 绑定邮箱和密码
    const { error: updateError } = await client
      .from('players')
      .update({
        bind_email: email.toLowerCase(),
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { success: false, error: '绑定失败，请重试' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        message: '账号升级成功！现在可以使用邮箱登录',
        email: email.toLowerCase(),
      },
    });
  } catch (error: any) {
    console.error('Link account error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '绑定失败' },
      { status: 500 }
    );
  }
}
