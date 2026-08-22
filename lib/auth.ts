import 'server-only';

import bcrypt from 'bcryptjs';
import { query, queryOne } from './db';
import { generateToken, hashToken } from './crypto';

export const SESSION_COOKIE = 'emblem_session';
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

/**
 * Whether to mark the session cookie `Secure` (HTTPS-only). Deliberately
 * derived from the ACTUAL request protocol rather than `NODE_ENV` — a
 * cookie marked Secure is silently dropped by the browser on a plain
 * http:// origin (e.g. local dev on localhost), and NODE_ENV is easy to
 * misconfigure (it should never be set by hand in .env; Next.js manages it
 * based on the command you run). Getting this wrong looks exactly like
 * "login succeeds but I keep getting bounced back to the login page" —
 * the cookie was never actually stored.
 */
export function shouldUseSecureCookie(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto === 'https';
  return new URL(req.url).protocol === 'https:';
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'owner';
  is_disabled: boolean;
  is_banned: boolean;
  totp_enabled: boolean;
  created_at: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Creates a new web session row and returns the plaintext token to set as a cookie. */
export async function createSession(userId: string, userAgent: string, ipHash: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await query(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip_hash, expires_at) VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, userAgent.slice(0, 300), ipHash, expiresAt]
  );
  return token;
}

/** Resolves a session cookie token to the user it belongs to, or null. */
export async function getUserFromSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const row = await queryOne<SessionUser & { session_expires: string; session_revoked: string | null }>(
    `SELECT users.id, users.username, users.email, users.role, users.is_disabled, users.is_banned,
            users.totp_enabled, users.created_at,
            sessions.expires_at AS session_expires, sessions.revoked_at AS session_revoked
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1`,
    [tokenHash]
  );

  if (!row) return null;
  if (row.session_revoked) return null;
  if (new Date(row.session_expires) < new Date()) return null;
  if (row.is_disabled || row.is_banned) return null;

  const { session_expires, session_revoked, ...user } = row;
  return user;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await query(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1`, [hashToken(token)]);
}

/** Logs out every session for a user except (optionally) the current one. */
export async function revokeAllSessions(userId: string, exceptToken?: string): Promise<void> {
  const exceptHash = exceptToken ? hashToken(exceptToken) : null;
  if (exceptHash) {
    await query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash != $2 AND revoked_at IS NULL`, [
      userId,
      exceptHash,
    ]);
  } else {
    await query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  }
}

export function isValidUsername(u: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

export function isValidEmail(e: string): boolean {
  return typeof e === 'string' && e.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'letmein123', 'welcome123', 'admin1234', 'iloveyou1',
]);

export function isCommonPassword(p: string): boolean {
  return COMMON_PASSWORDS.has(p.toLowerCase());
}

/** For use in Server Components / Route Handlers only (reads the cookie jar). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { cookies } = await import('next/headers');
  const token = cookies().get(SESSION_COOKIE)?.value;
  return getUserFromSessionToken(token);
}

export async function getCurrentSessionToken(): Promise<string | undefined> {
  const { cookies } = await import('next/headers');
  return cookies().get(SESSION_COOKIE)?.value;
}
