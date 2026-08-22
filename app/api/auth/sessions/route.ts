import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, getCurrentSessionToken, revokeAllSessions } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const currentToken = await getCurrentSessionToken();
  const currentHash = currentToken ? hashToken(currentToken) : null;

  const { rows } = await query<{ id: string; user_agent: string; created_at: string; token_hash: string }>(
    `SELECT id, user_agent, created_at, token_hash FROM sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC`,
    [user.id]
  );

  return NextResponse.json({
    sessions: rows.map((s) => ({
      id: s.id,
      userAgent: s.user_agent,
      createdAt: s.created_at,
      isCurrent: s.token_hash === currentHash,
    })),
  });
}

/** Revokes every session except the current one. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const currentToken = await getCurrentSessionToken();
  await revokeAllSessions(user.id, currentToken);

  return NextResponse.json({ ok: true });
}
