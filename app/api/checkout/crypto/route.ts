import { NextResponse } from 'next/server';
import { z } from 'zod';
import QRCode from 'qrcode';
import { queryOne, query } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { createCryptoPayment } from '@/lib/nowpayments';
import { isRateLimited } from '@/lib/rateLimit';
import { getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  planId: z.string().uuid(),
  payCurrency: z.string().min(2).max(20), // e.g. 'btc', 'eth', 'usdttrc20'
});

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    if (await isRateLimited(`checkout_crypto:${getRequestIpHash(req)}`, 10, 300)) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 });
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const plan = await queryOne<{ id: string; name: string; price_cents: number; currency: string; is_active: boolean }>(
      `SELECT id, name, price_cents, currency, is_active FROM pricing_plans WHERE id = $1`,
      [body.planId]
    );
    if (!plan || !plan.is_active) {
      return NextResponse.json({ error: 'That plan is not available.' }, { status: 404 });
    }

    const purchase = await queryOne<{ id: string }>(
      `INSERT INTO purchases (user_id, plan_id, payment_provider, amount_cents, currency, status)
       VALUES ($1, $2, 'nowpayments', $3, $4, 'pending') RETURNING id`,
      [auth.id, plan.id, plan.price_cents, plan.currency]
    );
    if (!purchase) return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });

    const siteUrl = process.env.SITE_URL || 'https://emblem.gg';

    let payment;
    try {
      payment = await createCryptoPayment({
        priceAmount: plan.price_cents / 100,
        priceCurrency: plan.currency,
        payCurrency: body.payCurrency,
        orderId: purchase.id,
        orderDescription: `Emblem — ${plan.name}`,
        ipnCallbackUrl: `${siteUrl}/api/webhooks/nowpayments`,
      });
    } catch (err) {
      console.error('[emblem] NOWPayments payment creation failed', err);
      return NextResponse.json(
        { error: 'Could not start crypto checkout right now. Check NOWPAYMENTS_API_KEY is set correctly, or try a different payment method.' },
        { status: 502 }
      );
    }

    await query(
      `UPDATE purchases SET crypto_payment_id = $1, crypto_pay_address = $2, crypto_pay_amount = $3, crypto_pay_currency = $4 WHERE id = $5`,
      [payment.payment_id, payment.pay_address, String(payment.pay_amount), payment.pay_currency, purchase.id]
    );

    const qrCodeDataUrl = await QRCode.toDataURL(payment.pay_address, { margin: 1, width: 260 });

    return NextResponse.json({
      purchaseId: purchase.id,
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
      payCurrency: payment.pay_currency,
      qrCodeDataUrl,
    });
  } catch (err) {
    console.error('[emblem] /api/checkout/crypto failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
