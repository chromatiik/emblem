import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { setConfig } from '@/lib/config';

export const runtime = 'nodejs';

const bodySchema = z.object({
  action: z.enum(['enable', 'disable', 'delete']),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const version = await queryOne<{ id: string; version: string }>(`SELECT id, version FROM script_versions WHERE id = $1`, [
    params.id,
  ]);
  if (!version) return NextResponse.json({ error: 'Version not found.' }, { status: 404 });

  if (body.action === 'enable') {
    // Only one version is ever "current" — enabling this one disables all others.
    await query(`UPDATE script_versions SET is_enabled = FALSE WHERE is_enabled = TRUE`);
    await query(`UPDATE script_versions SET is_enabled = TRUE WHERE id = $1`, [version.id]);
    await setConfig('current_version', version.version);
  } else if (body.action === 'disable') {
    await query(`UPDATE script_versions SET is_enabled = FALSE WHERE id = $1`, [version.id]);
    await setConfig('script_status', 'offline');
  } else if (body.action === 'delete') {
    await query(`DELETE FROM script_versions WHERE id = $1 AND is_enabled = FALSE`, [version.id]);
  }

  await logAudit({
    actorUserId: auth.id,
    action: `script_version_${body.action}`,
    targetType: 'script_version',
    targetId: version.id,
    details: { version: version.version },
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}
