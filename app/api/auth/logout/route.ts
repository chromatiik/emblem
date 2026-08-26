import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSessionByToken, SESSION_COOKIE } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function POSTHandler() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionByToken(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const POST = withErrorHandling(POSTHandler);

