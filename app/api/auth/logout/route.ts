import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSessionByToken, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionByToken(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
