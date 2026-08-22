import 'server-only';

import { NextResponse } from 'next/server';
import { getCurrentUser, type SessionUser } from './auth';

/**
 * Returns the current user if they're an admin/owner, or a 401/403
 * NextResponse to return immediately otherwise. Every admin API route
 * MUST call this and check the result — middleware.ts only redirects
 * unauthenticated *page* requests for UX; it does not run real DB-backed
 * authorization and must never be relied on as the actual security
 * boundary for API routes.
 *
 * Usage:
 *   const auth = await requireAdmin();
 *   if (auth instanceof NextResponse) return auth;
 *   const admin = auth; // SessionUser, guaranteed role admin|owner
 */
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return user;
}

/** Same pattern for owner-only actions (e.g. changing another admin's role). */
export async function requireOwner(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return user;
}

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return user;
}
