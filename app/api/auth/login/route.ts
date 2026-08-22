import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '@/lib/db';
import { createSession, SESSION_COOKIE, SESSION_DURATION_MS, shouldUseSecureCookie } from '@/lib/auth';
import { getRequestIpHash, logSecurityEvent } from '@/lib/audit';
import { isRateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  username: z.string(),
  password: z.string(),
  totpCode: z.string().optional(),
});

const LOCK_THRESHOLD = 6;
const LOCK_MINUTES = 15;
// A real bcrypt hash of a random value, compared against on every "user not
// found" path so login timing doesn't reveal whether a username exists.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8gPpqoxbQ8gwzxV6cX7NGmz1Rp8YQm';

export async function POST(req: Request) {
  const ipHash = getRequestIpHash(req);
  if (await isRateLimited(`login:${ipHash}`, 10, 900)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (!body.username || !body.password) {
    return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
  }

  const user = await queryOne<{
    id: string;
    password_hash: string;
    is_banned: boolean;
    is_disabled: boolean;
    failed_logins: number;
    locked_until: string | null;
    role: string;
    totp_enabled: boolean;
    totp_secret: string | null;
  }>(
    `SELECT id, password_hash, is_banned, is_disabled, failed_logins, locked_until, role, totp_enabled, totp_secret
     FROM users WHERE username_lower = $1`,
    [body.username.toLowerCase()]
  );

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.max(1, Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000));
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` },
      { status: 423 }
    );
  }

  const ok = await bcrypt.compare(body.password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    if (user) {
      const failedCount = (user.failed_logins || 0) + 1;
      if (failedCount >= LOCK_THRESHOLD) {
        await query(`UPDATE users SET failed_logins = $1, locked_until = now() + interval '${LOCK_MINUTES} minutes' WHERE id = $2`, [
          failedCount,
          user.id,
        ]);
        await logSecurityEvent({ userId: user.id, eventType: 'account_locked', ipHash });
      } else {
        await query(`UPDATE users SET failed_logins = $1 WHERE id = $2`, [failedCount, user.id]);
      }
      await logSecurityEvent({ userId: user.id, eventType: 'login_failed', ipHash });
    }
    return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 });
  }

  if (user.is_banned || user.is_disabled) {
    return NextResponse.json({ error: 'This account is not available.' }, { status: 403 });
  }

  // Admin/owner accounts with 2FA enrolled must supply a valid TOTP code.
  if ((user.role === 'admin' || user.role === 'owner') && user.totp_enabled) {
    if (!body.totpCode) {
      return NextResponse.json({ error: 'totp_required' }, { status: 401 });
    }
    const { authenticator } = await import('otplib');
    const valid = user.totp_secret ? authenticator.check(body.totpCode, user.totp_secret) : false;
    if (!valid) {
      await logSecurityEvent({ userId: user.id, eventType: 'totp_failed', ipHash });
      return NextResponse.json({ error: 'Invalid authentication code.' }, { status: 401 });
    }
  }

  if (user.failed_logins > 0 || user.locked_until) {
    await query(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [user.id]);
  }

  const token = await createSession(user.id, req.headers.get('user-agent') || '', ipHash);

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(req),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return res;
}
