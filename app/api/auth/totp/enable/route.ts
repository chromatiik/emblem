import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticator } from 'otplib';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const bodySchema = z.object({ code: z.string().length(6) });

async function POSTHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
  }

  const row = await queryOne<{ totp_secret: string | null }>(`SELECT totp_secret FROM users WHERE id = $1`, [auth.id]);
  if (!row?.totp_secret) {
    return NextResponse.json({ error: 'Start setup first.' }, { status: 400 });
  }

  if (!authenticator.check(body.code, row.totp_secret)) {
    return NextResponse.json({ error: 'Invalid code.' }, { status: 401 });
  }

  await query(`UPDATE users SET totp_enabled = TRUE WHERE id = $1`, [auth.id]);
  await logAudit({ actorUserId: auth.id, action: '2fa_enabled', ipHash: getRequestIpHash(req) });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(POSTHandler);

