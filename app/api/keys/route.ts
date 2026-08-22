import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/rbac';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { rows } = await query(
    `SELECT id, key_preview, status, hwid_hash IS NOT NULL AS hwid_bound, hwid_bound_at,
            hwid_reset_count, hwid_last_reset_at, usage_count, last_used_at,
            last_roblox_username, expires_at, created_at
     FROM keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [auth.id]
  );

  return NextResponse.json({ keys: rows });
}
