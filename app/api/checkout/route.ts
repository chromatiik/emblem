import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryOne, query } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { stripe } from '@/lib/stripe';
import { isRateLimited } from '@/lib/rateLimit';
import { getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

const bodySchema = z.object({ planId: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  if (await isRateLimited(`checkout:${getRequestIpHash(req)}`, 15, 300)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // The price is looked up server-side from our own database — the client
  // only ever supplies a plan ID, never an amount.
  const plan = await queryOne<{
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    stripe_price_id: string;
    is_active: boolean;
  }>(`SELECT id, name, price_cents, currency, stripe_price_id, is_active FROM pricing_plans WHERE id = $1`, [body.planId]);

  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: 'That plan is not available.' }, { status: 404 });
  }

  const siteUrl = process.env.SITE_URL || 'https://emblem.gg';

  const lineItem: any = plan.stripe_price_id
    ? { price: plan.stripe_price_id, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: plan.price_cents,
          product_data: { name: `Emblem — ${plan.name}` },
        },
      };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [lineItem],
    success_url: `${siteUrl}/dashboard?purchase=success`,
    cancel_url: `${siteUrl}/pricing?purchase=cancelled`,
    metadata: { userId: auth.id, planId: plan.id },
  });

  await query(
    `INSERT INTO purchases (user_id, plan_id, stripe_checkout_session_id, amount_cents, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [auth.id, plan.id, session.id, plan.price_cents, plan.currency]
  );

  return NextResponse.json({ checkoutUrl: session.url });
}
