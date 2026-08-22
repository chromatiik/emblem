import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { setConfig } from '@/lib/config';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { rows } = await query(`SELECT key, value, updated_at FROM configuration ORDER BY key`);
  return NextResponse.json({ config: rows });
}

const bodySchema = z.object({
  key: z.enum(['discord_invite_url', 'script_status', 'current_version']),
  value: z.string().max(500),
});

export const GET = withErrorHandling(GETHandler);

async function PATCHHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  await setConfig(body.key, body.value);
  await logAudit({
    actorUserId: auth.id,
    action: 'config_updated',
    targetType: 'configuration',
    targetId: body.key,
    details: { value: body.value },
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(PATCHHandler);

