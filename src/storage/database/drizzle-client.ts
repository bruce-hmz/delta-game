import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';

let drizzleInstance: ReturnType<typeof drizzle> | null = null;

export function getDrizzleClient() {
  if (drizzleInstance) return drizzleInstance;

  // Read Supabase connection config
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Convert Supabase URL to direct Postgres connection string
  // Format: https://<project-ref>.supabase.co → postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  // For dev, use the DATABASE_URL env var if available
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // Fall back to Supabase URL-based pooler connection
    // This requires the database password to be set in env
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;
    if (!dbPassword) {
      throw new Error(
        'DATABASE_URL or SUPABASE_DB_PASSWORD must be set for Drizzle client. ' +
        'Set DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres'
      );
    }

    const projectRef = url.replace('https://', '').replace('.supabase.co', '').replace('.supabase2.aidap-global.cn-beijing.volces.com', '');
    const poolerUrl = `postgres://postgres.${projectRef}:${dbPassword}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;

    const pool = new Pool({ connectionString: poolerUrl, ssl: true });
    drizzleInstance = drizzle(pool, { schema });
    return drizzleInstance;
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  drizzleInstance = drizzle(pool, { schema });
  return drizzleInstance;
}
