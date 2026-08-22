import 'server-only';

import { query } from './db';
import { hashIp } from './crypto';

export async function logAudit(params: {
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipHash?: string;
}): Promise<void> {
  await query(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.actorUserId,
      params.action,
      params.targetType ?? '',
      params.targetId ?? '',
      JSON.stringify(params.details ?? {}),
      params.ipHash ?? '',
    ]
  );
}

export async function logSecurityEvent(params: {
  userId?: string | null;
  eventType: string;
  ipHash?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await query(`INSERT INTO security_events (user_id, event_type, ip_hash, details) VALUES ($1, $2, $3, $4)`, [
    params.userId ?? null,
    params.eventType,
    params.ipHash ?? '',
    JSON.stringify(params.details ?? {}),
  ]);
}

/** Extracts a best-effort client IP from a Next.js Request and returns its hash (never the raw IP). */
export function getRequestIpHash(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  const ip = xff ? xff.split(',')[0]!.trim() : req.headers.get('x-real-ip') || '0.0.0.0';
  return hashIp(ip);
}

/**
 * Heuristic only — a browser announcing itself with a normal User-Agent.
 * Per the platform's security design, this is a defense-in-depth SIGNAL,
 * never the sole gate: the actual protection on the payload endpoint is
 * the short-lived, single-use, key-bound session token, which a browser
 * cannot obtain without going through the full authenticated handshake
 * (valid key + correctly-timed unused nonce). Spoofing this header does
 * not bypass that requirement.
 */
export function looksLikeBrowser(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /mozilla|chrome|safari|firefox|edg\/|opera|msie|trident/i.test(userAgent);
}
