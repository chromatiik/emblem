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
