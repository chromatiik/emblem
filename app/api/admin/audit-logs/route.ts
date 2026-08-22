import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);

  const { rows } = await query(
    `SELECT audit_logs.id, audit_logs.action, audit_logs.target_type, audit_logs.target_id, audit_logs.details,
            audit_logs.created_at, users.username AS actor_username
     FROM audit_logs LEFT JOIN users ON users.id = audit_logs.actor_user_id
     ORDER BY audit_logs.created_at DESC LIMIT $1`,
    [limit]
  );

  return NextResponse.json({ logs: rows });
}
