import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { rows } = await query(
    `SELECT id, name, description, price_cents, currency, duration_days, stripe_price_id, features, is_active, sort_order, created_at
     FROM pricing_plans ORDER BY sort_order ASC, price_cents ASC`
  );

  return NextResponse.json({ plans: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  durationDays: z.number().int().positive().nullable().optional(), // null/omitted = lifetime
  features: z.array(z.string().max(120)).max(20).optional(),
  stripePriceId: z.string().max(200).optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const plan = await queryOne<{ id: string }>(
    `INSERT INTO pricing_plans (name, description, price_cents, currency, duration_days, stripe_price_id, features, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      body.name,
      body.description ?? '',
      body.priceCents,
      (body.currency ?? 'gbp').toLowerCase(),
      body.durationDays ?? null,
      body.stripePriceId ?? '',
      body.features ?? [],
      body.sortOrder ?? 0,
    ]
  );

  await logAudit({
    actorUserId: auth.id,
    action: 'plan_created',
    targetType: 'pricing_plan',
    targetId: plan?.id,
    details: { name: body.name, priceCents: body.priceCents },
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ id: plan?.id });
}
