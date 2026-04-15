import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import crypto from 'crypto';

// 生成6位验证码
function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送邮箱验证码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: '请输入邮箱地址' },
        { status: 400 }
      );
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: '邮箱格式不正确' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 检查是否在60秒内已发送过
    const { data: recentCode } = await client
      .from('email_verification_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('used', false)
      .gt('expires_at', new Date(Date.now() - 60000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (recentCode) {
      return NextResponse.json(
        { success: false, error: '验证码已发送，请稍后再试' },
        { status: 429 }
      );
    }
    
    // 生成验证码
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期
    
    // 存储验证码
    const { error: insertError } = await client
      .from('email_verification_codes')
      .insert({
        email: email.toLowerCase(),
        code,
        expires_at: expiresAt.toISOString(),
      });
    
    if (insertError) {
      console.error('Failed to store OTP:', insertError);
      return NextResponse.json(
        { success: false, error: '验证码生成失败' },
        { status: 500 }
      );
    }
    
    // 尝试发送邮件（如果配置了邮件服务）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.COZE_SUPABASE_ANON_KEY;
    
    let emailSent = false;
    let emailError = null;
    
    if (supabaseUrl && anonKey) {
      try {
        // 调用 Supabase Edge Function 发送邮件
        const response = await fetch(`${supabaseUrl}/functions/v1/resend-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ email, code }),
        });
        
        if (response.ok) {
          emailSent = true;
        } else {
          const errorText = await response.text();
          emailError = errorText;
          console.log('Edge function not available, using dev mode');
        }
      } catch (err) {
        // Edge function 不存在或未部署，使用开发模式
        emailError = err;
      }
    }
    
    // 开发模式：返回验证码供测试（生产环境应该发送邮件）
    const isDev = process.env.COZE_PROJECT_ENV === 'DEV' || process.env.NODE_ENV === 'development';
    
    return NextResponse.json({
      success: true,
      message: '验证码已生成',
      // 开发模式返回验证码，方便测试
      ...(isDev && { devCode: code }),
    });
    
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: '发送失败，请稍后再试' },
      { status: 500 }
    );
  }
}
