import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Emergency button: immediately invalidates every loader session that has
 * been issued but not yet consumed (i.e. anyone mid-handshake right now).
 * Does not touch keys themselves — use /api/admin/keys/[id] to revoke/ban
 * individual keys, or disable the active script version to stop new
 * payload fetches entirely.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  await query(`UPDATE key_sessions SET status = 'expired' WHERE status = 'issued'`);
  await logAudit({ actorUserId: auth.id, action: 'emergency_session_revocation', ipHash: getRequestIpHash(req) });

  return NextResponse.json({ ok: true });
}
