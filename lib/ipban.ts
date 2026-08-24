import 'server-only';
import { query, queryOne } from './db';

export async function isIpBanned(ip: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(`SELECT id FROM banned_ips WHERE ip = $1`, [ip]);
  return Boolean(row);
}

export async function banIp(ip: string, reason: string, bannedByUserId: string): Promise<void> {
  await query(
    `INSERT INTO banned_ips (ip, reason, banned_by) VALUES ($1, $2, $3)
     ON CONFLICT (ip) DO UPDATE SET reason = $2, banned_by = $3`,
    [ip, reason, bannedByUserId]
  );
}

export async function unbanIp(ip: string): Promise<void> {
  await query(`DELETE FROM banned_ips WHERE ip = $1`, [ip]);
}

/** Records the account's most recent IP — used for admin visibility and to know what to ban. */
export async function recordUserIp(userId: string, ip: string): Promise<void> {
  await query(`UPDATE users SET last_ip = $1, last_ip_at = now() WHERE id = $2`, [ip, userId]);
}

/**
 * Logs a site visit for the /dashboard/admin/visitors page. Upserts by IP
 * so this is one row per visitor, not one row per page view — called from
 * the root layout on every page load, so it covers people who've never
 * made an account, not just logged-in users or people who've run the
 * script. Never throws — a logging failure should never take the site down.
 */
export async function logVisit(params: {
  ip: string;
  userId?: string | null;
  username?: string | null;
  path?: string;
  userAgent?: string;
}): Promise<void> {
  if (!params.ip || params.ip === '0.0.0.0') return;
  try {
    await query(
      `INSERT INTO site_visitors (ip, user_id, last_username, last_path, user_agent, visit_count, first_seen, last_seen)
       VALUES ($1, $2, $3, $4, $5, 1, now(), now())
       ON CONFLICT (ip) DO UPDATE SET
         user_id = COALESCE(EXCLUDED.user_id, site_visitors.user_id),
         last_username = COALESCE(NULLIF(EXCLUDED.last_username, ''), site_visitors.last_username),
         last_path = EXCLUDED.last_path,
         user_agent = EXCLUDED.user_agent,
         visit_count = site_visitors.visit_count + 1,
         last_seen = now()`,
      [params.ip, params.userId ?? null, params.username ?? '', params.path ?? '', params.userAgent ?? '']
    );
  } catch {
    // Visit logging is best-effort — never let it break page loads.
  }
}
