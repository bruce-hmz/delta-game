import { NextRequest, NextResponse } from 'next/server';

// 生成 Google OAuth 登录 URL - 使用 Supabase Auth
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      return NextResponse.json(
        { success: false, error: 'Supabase 未配置' },
        { status: 500 }
      );
    }
    
    // 使用 Supabase 的 OAuth 端点
    // 用户点击后会跳转到 Google，然后 Google 会回调到 Supabase
    // Supabase 处理后再重定向回我们的应用
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/';
    const siteUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || request.headers.get('host') 
      ? `https://${request.headers.get('host')}` 
      : 'http://localhost:5000';
    
    // Supabase OAuth URL
    const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${siteUrl}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`)}`;
    
    return NextResponse.json({
      success: true,
      data: {
        authUrl,
      },
    });
  } catch (error: any) {
    console.error('Google OAuth URL error:', error);
    return NextResponse.json(
      { success: false, error: '生成登录链接失败' },
      { status: 500 }
    );
  }
}
