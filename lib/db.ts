import 'server-only';

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('[emblem] Missing DATABASE_URL environment variable.');
}

// A module-level singleton pool, reused across warm serverless invocations.
const globalForPool = globalThis as unknown as { emblemPool?: Pool };

export const pool =
  globalForPool.emblemPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPool.emblemPool = pool;
}

/**
 * Always use parameterized queries ($1, $2, ...) — never string-concatenate
 * user input into SQL. Every call site in this project follows that rule.
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
  try {
    return (await pool.query(text, params)) as unknown as { rows: T[] };
  } catch (err: any) {
    // 42703 = undefined column, 22001 = value too long for column type.
    // Both are the signature of a database that's missing a schema change
    // (an ALTER TABLE from db/schema.sql that was never applied) rather
    // than a real bug — code changes alone can never fix these, only
    // running the migration against the actual database can. Without this,
    // the person just sees a cryptic raw Postgres driver error.
    if (err?.code === '42703' || err?.code === '22001') {
      const wrapped = new Error(
        `[emblem] Database schema is out of date (Postgres ${err.code}: ${err.message}). ` +
          `Run "npm run migrate" to apply db/schema.sql to your database, then try again.`
      );
      (wrapped as any).cause = err;
      throw wrapped;
    }
    throw err;
  }
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}
