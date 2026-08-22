import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { hashPassword, verifyPassword, isCommonPassword, getCurrentSessionToken, revokeAllSessions } from '@/lib/auth';
import { logAudit, getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (body.newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }
  if (isCommonPassword(body.newPassword)) {
    return NextResponse.json({ error: 'That password is too common — please choose another.' }, { status: 400 });
  }

  const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [auth.id]);
  const ok = row ? await verifyPassword(body.currentPassword, row.password_hash) : false;
  if (!ok) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
  }

  const newHash = await hashPassword(body.newPassword);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, auth.id]);

  const currentToken = await getCurrentSessionToken();
  await revokeAllSessions(auth.id, currentToken);

  await logAudit({ actorUserId: auth.id, action: 'password_changed', ipHash: getRequestIpHash(req) });

  return NextResponse.json({ ok: true });
}
