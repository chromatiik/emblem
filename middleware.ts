import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'emblem_session';
const VISIT_THROTTLE_COOKIE = 'emblem_vc';
const VISIT_THROTTLE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0]!.trim() : '0.0.0.0';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith('/dashboard') && !hasCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Skip the throttle for API routes - those have their own auth/rate-limit
  // concerns and don't run the root layout's visit-logging logic anyway.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  const ip = getIp(req);
  const requestHeaders = new Headers(req.headers);

  if (secret && ip !== '0.0.0.0') {
    const windowIndex = Math.floor(Date.now() / VISIT_THROTTLE_WINDOW_MS);
    const expected = await hmacHex(secret, `${ip}:${windowIndex}`);
    const incoming = req.cookies.get(VISIT_THROTTLE_COOKIE)?.value;

    if (incoming === expected) {
      // A previous request within this window already ran the real
      // ban-check + visit-log against Postgres and passed - safe to skip
      // repeating that DB round-trip for this one. Worst case if someone
      // gets banned mid-window: up to ~15 minutes of delayed enforcement,
      // which is an acceptable trade for cutting DB load on every single
      // page view down to roughly once per visitor per 15 minutes instead
      // of once per page.
      requestHeaders.set('x-recent-visit-check', '1');
    }

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.cookies.set(VISIT_THROTTLE_COOKIE, expected, {
      maxAge: Math.ceil(VISIT_THROTTLE_WINDOW_MS / 1000),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
