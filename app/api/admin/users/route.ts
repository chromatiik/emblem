import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin, requireOwner } from '@/lib/rbac';
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
    where = `WHERE users.username ILIKE $1 OR users.email ILIKE $1`;
  }

  const { rows } = await query(
    `SELECT users.id, users.username, users.email, users.role, users.is_disabled, users.is_banned,
            users.discord_username, users.roblox_username, users.created_at, users.last_ip, users.last_ip_at,
            (SELECT COUNT(*) FROM keys WHERE keys.user_id = users.id) AS key_count,
            (banned_ips.ip IS NOT NULL) AS ip_banned
     FROM users
     LEFT JOIN banned_ips ON banned_ips.ip = users.last_ip AND users.last_ip != ''
     ${where}
     ORDER BY users.created_at DESC LIMIT 200`,
    params
  );

  return NextResponse.json({ users: rows });
}

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['disable', 'enable', 'ban', 'unban', 'promote', 'demote', 'ban_ip', 'unban_ip']),
  reason: z.string().max(300).optional(),
});

export const GET = withErrorHandling(GETHandler);

async function PATCHHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const target = await queryOne<{ id: string; role: string; last_ip: string }>(
    `SELECT id, role, last_ip FROM users WHERE id = $1`,
    [body.userId]
  );
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Only an owner can change roles, and no one can touch another owner's account.
  if ((body.action === 'promote' || body.action === 'demote') ) {
    const ownerAuth = await requireOwner();
    if (ownerAuth instanceof NextResponse) return ownerAuth;
  }
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Owner accounts cannot be modified here.' }, { status: 403 });
  }

  if (body.action === 'ban_ip' || body.action === 'unban_ip') {
    if (!target.last_ip) {
      return NextResponse.json({ error: 'No known IP for this account yet.' }, { status: 400 });
    }
    if (body.action === 'ban_ip') {
      await banIp(target.last_ip, body.reason ?? '', auth.id);
    } else {
      await unbanIp(target.last_ip);
    }
    await logAudit({
      actorUserId: auth.id,
      action: `user_${body.action}`,
      targetType: 'user',
      targetId: body.userId,
      details: { ip: target.last_ip, reason: body.reason ?? null },
      ipHash: getRequestIpHash(req),
    });
    return NextResponse.json({ ok: true });
  }

  const actions: Record<string, string> = {
    disable: `UPDATE users SET is_disabled = TRUE WHERE id = $1`,
    enable: `UPDATE users SET is_disabled = FALSE WHERE id = $1`,
    ban: `UPDATE users SET is_banned = TRUE WHERE id = $1`,
    unban: `UPDATE users SET is_banned = FALSE WHERE id = $1`,
    promote: `UPDATE users SET role = 'admin' WHERE id = $1`,
    demote: `UPDATE users SET role = 'user' WHERE id = $1`,
  };

  await query(actions[body.action]!, [body.userId]);
  await logAudit({
    actorUserId: auth.id,
    action: `user_${body.action}`,
    targetType: 'user',
    targetId: body.userId,
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(PATCHHandler);

