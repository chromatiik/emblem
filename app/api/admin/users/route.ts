import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin, requireOwner } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const search = (url.searchParams.get('q') || '').trim();

  const params: any[] = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE username ILIKE $1 OR email ILIKE $1`;
  }

  const { rows } = await query(
    `SELECT id, username, email, role, is_disabled, is_banned, discord_username, roblox_username, created_at,
            (SELECT COUNT(*) FROM keys WHERE keys.user_id = users.id) AS key_count
     FROM users ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );

  return NextResponse.json({ users: rows });
}

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['disable', 'enable', 'ban', 'unban', 'promote', 'demote']),
});

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const target = await queryOne<{ id: string; role: string }>(`SELECT id, role FROM users WHERE id = $1`, [body.userId]);
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Only an owner can change roles, and no one can touch another owner's account.
  if ((body.action === 'promote' || body.action === 'demote') ) {
    const ownerAuth = await requireOwner();
    if (ownerAuth instanceof NextResponse) return ownerAuth;
  }
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Owner accounts cannot be modified here.' }, { status: 403 });
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
