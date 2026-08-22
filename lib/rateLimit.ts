import 'server-only';

import { query, queryOne } from './db';

/**
 * Returns true if the given bucket has exceeded `limit` hits within the
 * last `windowSeconds`, and records this attempt either way. Callers
 * should check the return value BEFORE performing the sensitive action.
 *
 * Buckets are free-form strings, e.g. `login:${ipHash}`,
 * `loader_auth:${keyHash}`, `register:${ipHash}`. Combine multiple buckets
 * (e.g. per-IP AND per-key) for layered protection where relevant.
 */
export async function isRateLimited(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM rate_limit_hits WHERE bucket = $1 AND created_at > now() - ($2 || ' seconds')::interval`,
    [bucket, windowSeconds]
  );
  const count = parseInt(row?.count ?? '0', 10);

  await query(`INSERT INTO rate_limit_hits (bucket) VALUES ($1)`, [bucket]);

  return count >= limit;
}

/** Best-effort cleanup of old rate-limit rows. Call occasionally (e.g. from a cron route) — not required for correctness, just table hygiene. */
export async function pruneOldRateLimitHits(olderThanHours = 24): Promise<void> {
  await query(`DELETE FROM rate_limit_hits WHERE created_at < now() - ($1 || ' hours')::interval`, [olderThanHours]);
}
