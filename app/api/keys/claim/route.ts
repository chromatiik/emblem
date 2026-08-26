import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { hashKey } from '@/lib/crypto';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const claimSchema = z.object({
  key: z.string().trim().min(6).max(64),
});

async function POSTHandler(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof claimSchema>;
  try {
    body = claimSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Enter a key.' }, { status: 400 });
  }

  const keyHash = hashKey(body.key);
  const existing = await queryOne<{ id: string; user_id: string | null; status: string }>(
    `SELECT id, user_id, status FROM keys WHERE key_hash = $1`,
    [keyHash]
  );

  if (!existing) {
    return NextResponse.json({ error: 'That key doesn\'t exist.' }, { status: 404 });
  }
  if (existing.status !== 'active') {
    return NextResponse.json({ error: `This key is ${existing.status} and can't be claimed.` }, { status: 400 });
  }
  if (existing.user_id === auth.id) {
    return NextResponse.json({ error: 'This key is already on your account.' }, { status: 400 });
  }
  // The actual anti-theft check: a key already bound to a DIFFERENT
  // account can never be rebound by someone else, no matter how they got
  // the key string. Only an unclaimed key (user_id IS NULL) is claimable.
  if (existing.user_id !== null) {
    return NextResponse.json({ error: 'This key is already bound to another account.' }, { status: 409 });
  }

  await query(`UPDATE keys SET user_id = $1 WHERE id = $2`, [auth.id, existing.id]);

  await logAudit({
    actorUserId: auth.id,
    action: 'key_claim',
    targetType: 'key',
    targetId: existing.id,
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(POSTHandler);
