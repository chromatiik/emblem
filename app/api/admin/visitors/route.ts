import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { banIp, unbanIp } from '@/lib/ipban';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const search = (url.searchParams.get('q') || '').trim();

  const params: any[] = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE site_visitors.ip ILIKE $1 OR site_visitors.last_username ILIKE $1`;
  }

  const { rows } = await query(
    `SELECT site_visitors.id, site_visitors.ip, site_visitors.user_id, site_visitors.last_username,
            site_visitors.visit_count, site_visitors.last_path, site_visitors.first_seen, site_visitors.last_seen,
            site_visitors.is_vpn,
            (banned_ips.ip IS NOT NULL) AS ip_banned
     FROM site_visitors
     LEFT JOIN banned_ips ON banned_ips.ip = site_visitors.ip
     ${where}
     ORDER BY site_visitors.last_seen DESC LIMIT 300`,
    params
  );

  return NextResponse.json({ visitors: rows });
}

export const GET = withErrorHandling(GETHandler);

const patchSchema = z.object({
  ip: z.string().min(3).max(64),
  action: z.enum(['ban', 'unban']),
  reason: z.string().max(300).optional(),
});

async function PATCHHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (body.action === 'ban') {
    await banIp(body.ip, body.reason ?? '', auth.id);
  } else {
    await unbanIp(body.ip);
  }

  await logAudit({
    actorUserId: auth.id,
    action: `visitor_ip_${body.action}`,
    targetType: 'ip',
    targetId: body.ip,
    details: { reason: body.reason ?? null },
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(PATCHHandler);
