// 绑定邮箱 API - 升级匿名账号为正式账号

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    // 从 Header 获取 token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证', needAuth: true },
        { status: 401 }
      );
    }
    
    const accessToken = authHeader.replace('Bearer ', '');
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
    
    // 创建带 token 的 Supabase 客户端
    const { url, anonKey } = getSupabaseCredentials();
    const client = createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    // 更新用户信息，绑定邮箱
    const { error } = await client.auth.updateUser({
      email,
      password,
    });
    
    if (error) {
      // 处理常见错误
      if (error.message.includes('already registered') || error.message.includes('already in use')) {
        return NextResponse.json(
          { success: false, error: '该邮箱已被注册，请使用其他邮箱' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        message: '邮箱绑定成功！验证邮件已发送，请查收。',
        email,
      },
    });
  } catch (error: any) {
    console.error('Link email error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '绑定邮箱失败' },
      { status: 500 }
    );
  }
}
