import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(300).optional(),
  priceCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  features: z.array(z.string().max(120)).max(20).optional(),
  stripePriceId: z.string().max(200).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

async function PATCHHandler(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const plan = await queryOne<{ id: string }>(`SELECT id FROM pricing_plans WHERE id = $1`, [params.id]);
  if (!plan) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const map: Record<string, unknown> = {
    name: body.name,
    description: body.description,
    price_cents: body.priceCents,
    currency: body.currency?.toLowerCase(),
    duration_days: body.durationDays,
    features: body.features,
    stripe_price_id: body.stripePriceId,
    sort_order: body.sortOrder,
    is_active: body.isActive,
  };

  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = $${i}`);
      values.push(value);
      i++;
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  values.push(params.id);
  await query(`UPDATE pricing_plans SET ${fields.join(', ')} WHERE id = $${i}`, values);

  await logAudit({
    actorUserId: auth.id,
    action: 'plan_updated',
    targetType: 'pricing_plan',
    targetId: params.id,
    details: body,
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(PATCHHandler);

async function DELETEHandler(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await query(`DELETE FROM pricing_plans WHERE id = $1`, [params.id]);
    await logAudit({ actorUserId: auth.id, action: 'plan_deleted', targetType: 'pricing_plan', targetId: params.id, ipHash: getRequestIpHash(req) });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === '23503') {
      // foreign key violation — purchases reference this plan
      return NextResponse.json(
        { error: 'This plan has existing purchases and can\u2019t be deleted — deactivate it instead.' },
        { status: 409 }
      );
    }
    throw err;
  }
}

export const DELETE = withErrorHandling(DELETEHandler);

