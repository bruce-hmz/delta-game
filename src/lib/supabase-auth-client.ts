// Supabase Auth 客户端 - 前端专用

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let credentialsPromise: Promise<{ url: string; anonKey: string }> | null = null;

/**
 * 从服务端获取 Supabase 配置
 */
async function fetchSupabaseCredentials(): Promise<{ url: string; anonKey: string }> {
  if (credentialsPromise) {
    return credentialsPromise;
  }
  
  credentialsPromise = (async () => {
    try {
      const res = await fetch('/api/auth/config');
      const data = await res.json();
      
      if (data.success && data.data.url && data.data.anonKey) {
        return { url: data.data.url, anonKey: data.data.anonKey };
      }
      
      throw new Error(data.error || '获取配置失败');
    } catch (error) {
      credentialsPromise = null;
      throw error;
    }
  })();
  
  return credentialsPromise;
}

/**
 * 获取 Supabase 客户端（前端）
 */
export async function getSupabaseAuthClient(): Promise<SupabaseClient> {
  if (!supabaseClient) {
    const { url, anonKey } = await fetchSupabaseCredentials();
    
    supabaseClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  }
  
  return supabaseClient;
}

/**
 * 匿名登录
 * 自动创建临时账号，获取 user_id 和 access_token
 */
export async function signInAnonymously(): Promise<{
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}> {
  try {
    const client = await getSupabaseAuthClient();
    
    const { data, error } = await client.auth.signInAnonymously();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return {
      success: true,
      user: data.user!,
      session: data.session!,
    };
  } catch (err: any) {
    return { success: false, error: err.message || '匿名登录失败' };
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<{
  user: User | null;
  session: Session | null;
}> {
  const client = await getSupabaseAuthClient();
  
  const { data: { user } } = await client.auth.getUser();
  const { data: { session } } = await client.auth.getSession();
  
  return { user, session };
}

/**
 * 获取当前 access_token
 */
export async function getAccessToken(): Promise<string | null> {
  const client = await getSupabaseAuthClient();
  
  const { data: { session } } = await client.auth.getSession();
  
  return session?.access_token || null;
}

/**
 * 绑定邮箱（升级为正式账号）
 */
export async function linkEmail(
  email: string, 
  password: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await getSupabaseAuthClient();
    
    const { error } = await client.auth.updateUser({
      email,
      password,
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '绑定邮箱失败' };
  }
}

/**
 * 登出
 */
export async function signOut(): Promise<void> {
  const client = await getSupabaseAuthClient();
  await client.auth.signOut();
  clearStoredToken();
}

/**
 * 邮箱注册
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  guestSessionId?: string
): Promise<{
  success: boolean;
  accessToken?: string;
  user?: { id: string; email: string };
  playerId?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, guestSessionId })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || '注册失败' };
    }

    // 存储 token 到 localStorage
    if (data.accessToken && typeof window !== 'undefined') {
      localStorage.setItem('access_token', data.accessToken);
    }

    return {
      success: true,
      accessToken: data.accessToken,
      user: data.user,
      playerId: data.playerId
    };
  } catch (err: any) {
    return { success: false, error: err.message || '注册失败' };
  }
}

/**
 * 邮箱登录
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  accessToken?: string;
  user?: { id: string; email: string };
  playerId?: string;
  streaks?: any;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || '登录失败' };
    }

    // 存储 token
    if (data.accessToken && typeof window !== 'undefined') {
      localStorage.setItem('access_token', data.accessToken);
    }

    return {
      success: true,
      accessToken: data.accessToken,
      user: data.user,
      playerId: data.playerId,
      streaks: data.streaks
    };
  } catch (err: any) {
    return { success: false, error: err.message || '登录失败' };
  }
}

/**
 * 获取存储的 access token
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * 清除 token
 */
export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
}

// 创建一个同步的客户端包装器（用于 useState 初始化等场景）
let clientInstance: SupabaseClient | null = null;

export const supabaseAuthClient = {
  auth: {
    getSession: async () => {
      const client = await getSupabaseAuthClient();
      return client.auth.getSession();
    },
    signInAnonymously: async () => {
      const client = await getSupabaseAuthClient();
      return client.auth.signInAnonymously();
    },
    getUser: async () => {
      const client = await getSupabaseAuthClient();
      return client.auth.getUser();
    },
    signOut: async () => {
      const client = await getSupabaseAuthClient();
      return client.auth.signOut();
    },
    updateUser: async (updates: any) => {
      const client = await getSupabaseAuthClient();
      return client.auth.updateUser(updates);
    },
  },
};
