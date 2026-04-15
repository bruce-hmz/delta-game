import { NextRequest, NextResponse } from 'next/server';

// Supabase OAuth 回调处理
// Supabase 处理完 OAuth 后会重定向到这里，携带 token
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Supabase 回调会携带这些参数
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const redirectTo = searchParams.get('redirectTo') || '/';
    
    // 处理错误
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('auth', 'error');
      redirectUrl.searchParams.set('message', errorDescription || error);
      return NextResponse.redirect(redirectUrl);
    }
    
    if (!accessToken) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('auth', 'error');
      redirectUrl.searchParams.set('message', 'no_token');
      return NextResponse.redirect(redirectUrl);
    }
    
    // 使用 access token 获取用户信息
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': process.env.COZE_SUPABASE_ANON_KEY || '',
      },
    });
    
    if (!userResponse.ok) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('auth', 'error');
      redirectUrl.searchParams.set('message', 'user_fetch_failed');
      return NextResponse.redirect(redirectUrl);
    }
    
    const userData = await userResponse.json();
    const googleId = userData.user_metadata?.provider_id || userData.id;
    const googleEmail = userData.email;
    const googleName = userData.user_metadata?.full_name || userData.user_metadata?.name || googleEmail?.split('@')[0];
    
    if (!googleEmail) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('auth', 'error');
      redirectUrl.searchParams.set('message', 'no_email');
      return NextResponse.redirect(redirectUrl);
    }
    
    // 动态导入 Supabase client
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const { v4: uuidv4 } = await import('uuid');
    const client = getSupabaseClient();
    
    // 生成 token
    const generateToken = (userId: string): string => {
      const timestamp = Date.now();
      const signature = Buffer.from(`${userId}:${timestamp}`).toString('base64').slice(0, 16);
      return `${userId}.${timestamp}.${signature}`;
    };
    
    // 查找是否已有绑定此 Google 账号的用户
    const { data: existingByGoogleId } = await client
      .from('players')
      .select('*')
      .eq('google_id', googleId)
      .single();
    
    if (existingByGoogleId) {
      // 已绑定，直接登录
      const token = generateToken(existingByGoogleId.id);
      
      // 更新最后登录时间
      await client
        .from('players')
        .update({ last_login: new Date().toISOString() })
        .eq('id', existingByGoogleId.id);
      
      const redirectUrl = new URL(redirectTo, request.url);
      redirectUrl.searchParams.set('token', token);
      redirectUrl.searchParams.set('userId', existingByGoogleId.id);
      redirectUrl.searchParams.set('auth', 'success');
      return NextResponse.redirect(redirectUrl);
    }
    
    // 检查邮箱是否已被绑定
    const { data: existingByEmail } = await client
      .from('players')
      .select('*')
      .eq('bind_email', googleEmail)
      .single();
    
    if (existingByEmail) {
      // 邮箱已被绑定，将 Google ID 关联到现有账号
      await client
        .from('players')
        .update({ 
          google_id: googleId,
          google_email: googleEmail,
          last_login: new Date().toISOString()
        })
        .eq('id', existingByEmail.id);
      
      const token = generateToken(existingByEmail.id);
      
      const redirectUrl = new URL(redirectTo, request.url);
      redirectUrl.searchParams.set('token', token);
      redirectUrl.searchParams.set('userId', existingByEmail.id);
      redirectUrl.searchParams.set('auth', 'linked');
      return NextResponse.redirect(redirectUrl);
    }
    
    // 新用户，创建账号
    const newUserId = uuidv4();
    const { error: insertError } = await client
      .from('players')
      .insert({
        id: newUserId,
        name: googleName,
        google_id: googleId,
        google_email: googleEmail,
        bind_email: googleEmail,
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
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('auth', 'error');
      redirectUrl.searchParams.set('message', 'create_failed');
      return NextResponse.redirect(redirectUrl);
    }
    
    const token = generateToken(newUserId);
    
    const redirectUrl = new URL(redirectTo, request.url);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('userId', newUserId);
    redirectUrl.searchParams.set('auth', 'registered');
    redirectUrl.searchParams.set('name', encodeURIComponent(googleName));
    return NextResponse.redirect(redirectUrl);
    
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth', 'error');
    redirectUrl.searchParams.set('message', 'unknown');
    return NextResponse.redirect(redirectUrl);
  }
}
