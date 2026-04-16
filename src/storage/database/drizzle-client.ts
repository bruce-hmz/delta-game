import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';

let drizzleInstance: ReturnType<typeof drizzle> | null = null;

export function getDrizzleClient() {
  if (drizzleInstance) return drizzleInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL must be set. Example: postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
  }

  // Supabase pooler requires SSL. Use the connection string directly
  // with ?sslmode=require appended if not already present.
  const sslUrl = connectionString.includes('sslmode')
    ? connectionString
    : `${connectionString}${connectionString.includes('?') ? '&' : '?'}sslmode=require`;

  const pool = new Pool({
    connectionString: sslUrl,
    ssl: true,
  });

  drizzleInstance = drizzle(pool, { schema });
  return drizzleInstance;
}
