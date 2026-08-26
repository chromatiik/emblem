import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler(req: Request) {
  const url = new URL(req.url);
  const search = (url.searchParams.get('q') || '').trim();
  const tag = (url.searchParams.get('tag') || '').trim();
  const sort = url.searchParams.get('sort') === 'new' ? 'new' : 'popular';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const perPage = 24;

  const params: any[] = [];
  const where: string[] = [];

  if (search) {
    params.push(search);
    where.push(`marketplace_configs.search_vector @@ websearch_to_tsquery('english', $${params.length})`);
  }
  if (tag) {
    params.push([tag]);
    where.push(`marketplace_configs.tags @> $${params.length}::text[]`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = sort === 'new' ? 'marketplace_configs.created_at DESC' : 'marketplace_configs.download_count DESC, marketplace_configs.created_at DESC';

  params.push(perPage, (page - 1) * perPage);
  const { rows } = await query(
    `SELECT marketplace_configs.id, marketplace_configs.name, marketplace_configs.description, marketplace_configs.tags,
            marketplace_configs.download_count, marketplace_configs.created_at, users.username AS author
     FROM marketplace_configs
     JOIN users ON users.id = marketplace_configs.user_id
     ${whereSql}
     ORDER BY ${orderSql}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return NextResponse.json({ configs: rows });
}

export const GET = withErrorHandling(GETHandler);

const uploadSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).optional().default([]),
  configJson: z.string().min(2).max(200_000),
});

async function POSTHandler(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof uploadSchema>;
  try {
    body = uploadSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ error: err?.errors?.[0]?.message || 'Invalid config.' }, { status: 400 });
  }

  // Must be valid JSON, even though it's stored as text — catches obvious
  // paste mistakes before they end up in the marketplace.
  try {
    JSON.parse(body.configJson);
  } catch {
    return NextResponse.json({ error: 'That doesn\'t look like valid config JSON.' }, { status: 400 });
  }

  const tags = Array.from(new Set(body.tags.map((t) => t.toLowerCase())));

  const { rows } = await query<{ id: string }>(
    `INSERT INTO marketplace_configs (user_id, name, description, tags, config_json)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [auth.id, body.name, body.description, tags, body.configJson]
  );

  return NextResponse.json({ ok: true, id: rows[0]!.id });
}

export const POST = withErrorHandling(POSTHandler);
