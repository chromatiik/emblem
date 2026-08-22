import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { verifyPassword } from '@/lib/auth';
import { logAudit, getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

const bodySchema = z.object({ password: z.string() });

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [auth.id]);
  const ok = row ? await verifyPassword(body.password, row.password_hash) : false;
  if (!ok) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  await query(`UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1`, [auth.id]);
  await logAudit({ actorUserId: auth.id, action: '2fa_disabled', ipHash: getRequestIpHash(req) });

  return NextResponse.json({ ok: true });
}
