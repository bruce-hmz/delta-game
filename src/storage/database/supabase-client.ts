import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

// 从配置文件读取配置（支持多种格式）
function readSupabaseConfig(): { url?: string; anonKey?: string; serviceRoleKey?: string } {
  const cwd = process.cwd();
  
  // 尝试多种配置文件
  const configFiles = [
    path.join(cwd, 'supabase_config.json'),
    path.join(cwd, '.env'),
    path.join(cwd, '.env.local'),
  ];
  
  for (const configPath of configFiles) {
    if (!fs.existsSync(configPath)) continue;
    
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      
      // JSON 格式
      if (configPath.endsWith('.json')) {
        const json = JSON.parse(content);
        return {
          url: json.SUPABASE_URL || json.url,
          anonKey: json.SUPABASE_ANON_KEY || json.anonKey,
          serviceRoleKey: json.SUPABASE_SERVICE_ROLE_KEY || json.serviceRoleKey,
        };
      }
      
      // .env 格式
      const lines = content.split('\n');
      let url: string | undefined;
      let anonKey: string | undefined;
      let serviceRoleKey: string | undefined;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();
          
          // 移除引号
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          if (key === 'SUPABASE_URL' || key === 'NEXT_PUBLIC_SUPABASE_URL') {
            url = url || value;
          } else if (key === 'SUPABASE_ANON_KEY' || key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
            anonKey = anonKey || value;
          } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
            serviceRoleKey = serviceRoleKey || value;
          }
        }
      }
      
      if (url && anonKey) {
        return { url, anonKey, serviceRoleKey };
      }
    } catch (err) {
      // 继续尝试下一个文件
    }
  }
  
  return {};
}

function getSupabaseCredentials(): SupabaseCredentials {
  // 优先从环境变量读取（Vercel 部署时使用）
  const envUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (envUrl && envAnonKey) {
    console.log('[Supabase Config] Using environment variables:', envUrl);
    return { url: envUrl, anonKey: envAnonKey };
  }
  
  // 回退到配置文件（本地开发时使用）
  const config = readSupabaseConfig();
  
  if (config.url && config.anonKey) {
    console.log('[Supabase Config] Using supabase_config.json:', config.url);
    return { url: config.url, anonKey: config.anonKey };
  }
  
  // 如果都读取失败，抛出错误
  console.error('[Supabase Config] Failed to read config from env or file');
  throw new Error('Failed to read Supabase config. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables, or ensure supabase_config.json exists.');
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// 服务端 Supabase Admin 客户端（使用 service_role key）
export function getSupabaseAdminClient(): SupabaseClient {
  // 优先从环境变量读取
  const envUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (envUrl && envServiceRoleKey) {
    return createClient(envUrl, envServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        timeout: 60000,
      },
    });
  }
  
  // 回退到配置文件
  const config = readSupabaseConfig();
  
  if (!config.url || !config.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in config or environment. Admin operations require service role key.');
  }
  
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      timeout: 60000,
    },
  });
}

export { getSupabaseCredentials, getSupabaseClient };
