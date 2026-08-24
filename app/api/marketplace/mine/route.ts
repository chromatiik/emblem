import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { rows } = await query(
    `SELECT id, name, description, tags, download_count, created_at
     FROM marketplace_configs WHERE user_id = $1 ORDER BY created_at DESC`,
    [auth.id]
  );

  return NextResponse.json({ configs: rows });
}

export const GET = withErrorHandling(GETHandler);
