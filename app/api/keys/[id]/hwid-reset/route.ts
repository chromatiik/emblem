import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const COOLDOWN_HOURS = 24 * 7; // one self-service reset per key per week

async function POSTHandler(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const key = await queryOne<{ id: string; hwid_hash: string | null; hwid_last_reset_at: string | null }>(
    `SELECT id, hwid_hash, hwid_last_reset_at FROM keys WHERE id = $1 AND user_id = $2`,
    [params.id, auth.id]
  );

  if (!key) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });

  if (!key.hwid_hash) {
    return NextResponse.json({ error: 'This key has no device bound yet.' }, { status: 400 });
  }

  if (key.hwid_last_reset_at) {
    const nextAllowed = new Date(key.hwid_last_reset_at).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000;
    if (Date.now() < nextAllowed) {
      const hoursLeft = Math.ceil((nextAllowed - Date.now()) / (60 * 60 * 1000));
      return NextResponse.json(
        { error: `You can reset this key's device again in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.` },
        { status: 429 }
      );
    }
  }

  await query(
    `UPDATE keys SET hwid_hash = NULL, hwid_bound_at = NULL, hwid_reset_count = hwid_reset_count + 1, hwid_last_reset_at = now()
     WHERE id = $1`,
    [key.id]
  );
  await query(`INSERT INTO hwid_resets (key_id, old_hwid_hash, reset_by, reset_by_user_id) VALUES ($1, $2, 'user', $3)`, [
    key.id,
    key.hwid_hash,
    auth.id,
  ]);
  await logAudit({
    actorUserId: auth.id,
    action: 'hwid_reset',
    targetType: 'key',
    targetId: key.id,
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(POSTHandler);

