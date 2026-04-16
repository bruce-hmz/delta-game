import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';

let drizzleInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDrizzleClient() {
  if (drizzleInstance) return drizzleInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL must be set.');
  }

  // Parse URL manually to avoid pg connection string parsing issues
  const url = new URL(connectionString);

  console.log(`[Drizzle] Connecting to ${url.hostname}:${url.port} as ${url.username}`);

  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  drizzleInstance = drizzle(pool, { schema });
  return drizzleInstance;
}

// 导出 db 实例供 API 路由使用（懒加载）
export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop) {
    const client = getDrizzleClient();
    return (client as any)[prop];
  }
});
