import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import {
  hashPassword,
  createSession,
  isValidUsername,
  isValidEmail,
  isCommonPassword,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  shouldUseSecureCookie,
} from '@/lib/auth';
import { getRequestIp, getRequestIpHash } from '@/lib/audit';
import { isRateLimited } from '@/lib/rateLimit';
import { isIpBanned, recordUserIp } from '@/lib/ipban';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const bodySchema = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
});

async function POSTHandler(req: Request) {
  const ip = getRequestIp(req);
  const ipHash = getRequestIpHash(req);

  if (await isIpBanned(ip)) {
    return NextResponse.json({ error: 'Unable to create an account.' }, { status: 403 });
  }

  if (await isRateLimited(`register:${ipHash}`, 8, 900)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { username, email, password } = body;

  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Username must be 3-20 characters: letters, numbers, underscores only.' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (isCommonPassword(password)) {
    return NextResponse.json({ error: 'That password is too common — please choose another.' }, { status: 400 });
  }

  const usernameLower = username.toLowerCase();
  const emailLower = email.toLowerCase();

  const existing = await queryOne(`SELECT id FROM users WHERE username_lower = $1 OR email = $2`, [usernameLower, emailLower]);
  if (existing) {
    return NextResponse.json({ error: 'That username or email is already taken.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (username, username_lower, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, usernameLower, emailLower, passwordHash]
  );
  if (!user) {
    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
  }

  await recordUserIp(user.id, ip);

  const token = await createSession(user.id, req.headers.get('user-agent') || '', ipHash);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(req),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return res;
}

export const POST = withErrorHandling(POSTHandler);

