import 'server-only';
import { query, queryOne } from './db';
import { checkIsVpn } from './vpn';

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

/**
 * Records the account's most recent IP — used for admin visibility and to
 * know what to ban. VPN-aware: a VPN IP never overwrites an already-known
 * real IP (shared/rotating VPN exits make a poor ban target), but a real
 * IP always overwrites a previously-seen VPN one, and a VPN IP is still
 * recorded if nothing better is known yet. Only called from login/register
 * (not the loader, which runs far more often) so the inline VPN lookup
 * here doesn't eat into getipintel's tight rate limit.
 */
export async function recordUserIp(userId: string, ip: string): Promise<void> {
  const isVpn = (await checkIsVpn(ip)) ?? false;
  await query(
    `UPDATE users SET
       last_ip = CASE WHEN NOT $1 OR last_ip = '' OR last_ip_is_vpn THEN $2 ELSE last_ip END,
       last_ip_is_vpn = CASE WHEN NOT $1 OR last_ip = '' OR last_ip_is_vpn THEN $1 ELSE last_ip_is_vpn END,
       last_ip_at = CASE WHEN NOT $1 OR last_ip = '' OR last_ip_is_vpn THEN now() ELSE last_ip_at END
     WHERE id = $3`,
    [isVpn, ip, userId]
  );
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
    const { rows } = await query<{ is_new: boolean; already_checked: boolean }>(
      `INSERT INTO site_visitors (ip, user_id, last_username, last_path, user_agent, visit_count, first_seen, last_seen)
       VALUES ($1, $2, $3, $4, $5, 1, now(), now())
       ON CONFLICT (ip) DO UPDATE SET
         user_id = COALESCE(EXCLUDED.user_id, site_visitors.user_id),
         last_username = COALESCE(NULLIF(EXCLUDED.last_username, ''), site_visitors.last_username),
         last_path = EXCLUDED.last_path,
         user_agent = EXCLUDED.user_agent,
         visit_count = site_visitors.visit_count + 1,
         last_seen = now()
       RETURNING (xmax = 0) AS is_new, (vpn_checked_at IS NOT NULL) AS already_checked`,
      [params.ip, params.userId ?? null, params.username ?? '', params.path ?? '', params.userAgent ?? '']
    );

    // Check each IP for VPN status at most once, well after the row is
    // already written — this must never be awaited by the caller, since
    // getipintel.net can take a couple seconds and this app renders pages
    // on every single request.
    if (rows[0] && !rows[0].already_checked) {
      const ip = params.ip;
      checkIsVpn(ip)
        .then((isVpn) => {
          if (isVpn === null) return; // check failed/skipped — leave as "unknown", try again next visit
          return query(`UPDATE site_visitors SET is_vpn = $1, vpn_checked_at = now() WHERE ip = $2`, [isVpn, ip]);
        })
        .catch(() => {});
    }
  } catch {
    // Visit logging is best-effort — never let it break page loads.
  }
}
