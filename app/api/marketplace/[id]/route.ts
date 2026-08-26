import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler(_req: Request, { params }: { params: { id: string } }) {
  const config = await queryOne<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    config_json: string;
    download_count: number;
    created_at: string;
    user_id: string;
    author: string;
  }>(
    `SELECT marketplace_configs.id, marketplace_configs.name, marketplace_configs.description, marketplace_configs.tags,
            marketplace_configs.config_json, marketplace_configs.download_count, marketplace_configs.created_at,
            marketplace_configs.user_id, users.username AS author
     FROM marketplace_configs
     JOIN users ON users.id = marketplace_configs.user_id
     WHERE marketplace_configs.id = $1`,
    [params.id]
  );
  if (!config) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // Downloading counts once per (config, user) — logged in only, so a
  // download always has an attributable account, and one person spamming
  // the download button doesn't inflate the count.
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    const { rows: inserted } = await query(
      `INSERT INTO marketplace_downloads (config_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING config_id`,
      [config.id, user.id]
    );
    if (inserted.length > 0) {
      await query(`UPDATE marketplace_configs SET download_count = download_count + 1 WHERE id = $1`, [config.id]);
      config.download_count += 1;
    }
  }

  return NextResponse.json({ config });
}

export const GET = withErrorHandling(GETHandler);

async function DELETEHandler(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const config = await queryOne<{ user_id: string }>(`SELECT user_id FROM marketplace_configs WHERE id = $1`, [params.id]);
  if (!config) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (config.user_id !== auth.id && auth.role !== 'admin' && auth.role !== 'owner') {
    return NextResponse.json({ error: 'Not your config.' }, { status: 403 });
  }

  await query(`DELETE FROM marketplace_configs WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}

export const DELETE = withErrorHandling(DELETEHandler);
