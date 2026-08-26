import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const bodySchema = z.object({
  action: z.enum(['revoke', 'ban', 'unban', 'reactivate', 'hwid_reset', 'extend']),
  extendDays: z.number().int().positive().optional(),
  note: z.string().max(300).optional(),
});

async function PATCHHandler(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const key = await queryOne<{ id: string; hwid_hash: string | null }>(`SELECT id, hwid_hash FROM keys WHERE id = $1`, [params.id]);
  if (!key) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });

  switch (body.action) {
    case 'revoke':
      await query(`UPDATE keys SET status = 'revoked', revoked_at = now() WHERE id = $1`, [key.id]);
      break;
    case 'ban':
      await query(`UPDATE keys SET status = 'banned', banned_at = now() WHERE id = $1`, [key.id]);
      break;
    case 'unban':
    case 'reactivate':
      await query(`UPDATE keys SET status = 'active', revoked_at = NULL, banned_at = NULL WHERE id = $1`, [key.id]);
      break;
    case 'hwid_reset':
      if (key.hwid_hash) {
        await query(
          `UPDATE keys SET hwid_hash = NULL, hwid_bound_at = NULL, hwid_reset_count = hwid_reset_count + 1, hwid_last_reset_at = now() WHERE id = $1`,
          [key.id]
        );
        await query(`INSERT INTO hwid_resets (key_id, old_hwid_hash, reset_by, reset_by_user_id) VALUES ($1,$2,'admin',$3)`, [
          key.id,
          key.hwid_hash,
          auth.id,
        ]);
      }
      break;
    case 'extend':
      if (!body.extendDays) {
        return NextResponse.json({ error: 'extendDays is required for this action.' }, { status: 400 });
      }
      await query(
        `UPDATE keys SET expires_at = GREATEST(COALESCE(expires_at, now()), now()) + ($1 || ' days')::interval WHERE id = $2`,
        [body.extendDays, key.id]
      );
      break;
  }

  if (body.note !== undefined) {
    await query(`UPDATE keys SET admin_notes = $1 WHERE id = $2`, [body.note, key.id]);
  }

  await logAudit({
    actorUserId: auth.id,
    action: `key_${body.action}`,
    targetType: 'key',
    targetId: key.id,
    details: { extendDays: body.extendDays ?? null },
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(PATCHHandler);

async function DELETEHandler(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const key = await queryOne<{ id: string; key_preview: string }>(`SELECT id, key_preview FROM keys WHERE id = $1`, [params.id]);
  if (!key) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });

  try {
    await query(`DELETE FROM keys WHERE id = $1`, [key.id]);
  } catch (err: any) {
    if (err?.code === '23503') {
      // foreign key violation — a purchase record still points at this key.
      // Purchases are financial history and deliberately don't cascade-delete.
      return NextResponse.json(
        { error: 'This key has a purchase record tied to it and can\u2019t be deleted — revoke or ban it instead.' },
        { status: 409 }
      );
    }
    throw err;
  }

  await logAudit({
    actorUserId: auth.id,
    action: 'key_deleted',
    targetType: 'key',
    targetId: key.id,
    details: { keyPreview: key.key_preview },
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const DELETE = withErrorHandling(DELETEHandler);

