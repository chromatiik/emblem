import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyIpnSignature } from '@/lib/nowpayments';
import { generateLicenseKey, hashKey, keyPreview } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

function computeExpiry(durationDays: number | null): Date | null {
  if (durationDays === null || durationDays === undefined) return null;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

async function activateKeyForCryptoPurchase(paymentId: string) {
  // Same atomic-claim pattern used for Stripe: only transitions
  // pending -> processing once, so a redelivered/duplicate webhook can't
  // double-issue a key even if it races with itself.
  const purchase = await queryOne<{ id: string; user_id: string; plan_id: string }>(
    `UPDATE purchases SET status = 'processing' WHERE crypto_payment_id = $1 AND status = 'pending'
     RETURNING id, user_id, plan_id`,
    [paymentId]
  );
  if (!purchase) return;

  const plan = await queryOne<{ duration_days: number | null }>(`SELECT duration_days FROM pricing_plans WHERE id = $1`, [
    purchase.plan_id,
  ]);

  const plaintext = generateLicenseKey();
  const key = await queryOne<{ id: string }>(
    `INSERT INTO keys (key_hash, key_preview, user_id, plan_id, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [hashKey(plaintext), keyPreview(plaintext), purchase.user_id, purchase.plan_id, computeExpiry(plan?.duration_days ?? null)]
  );

  await query(`UPDATE purchases SET status = 'paid', key_id = $1, paid_at = now() WHERE id = $2`, [key?.id, purchase.id]);

  await logAudit({
    actorUserId: null,
    action: 'crypto_purchase_completed',
    targetType: 'purchase',
    targetId: purchase.id,
    details: { keyId: key?.id, paymentId },
  });
}

export async function POST(req: Request) {
  const signature = req.headers.get('x-nowpayments-sig');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const rawBody = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  let validSig: boolean;
  try {
    validSig = verifyIpnSignature(payload, signature);
  } catch (err) {
    console.error('[emblem] IPN signature verification error', err);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }

  if (!validSig) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const paymentId = String(payload.payment_id ?? '');
  const paymentStatus = String(payload.payment_status ?? '');
  if (!paymentId || !paymentStatus) {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }

  // Idempotency: a (payment_id, payment_status) pair is only ever acted on
  // once — NOWPayments can and does redeliver the same status update.
  const inserted = await queryOne(
    `INSERT INTO crypto_payment_events (payment_id, payment_status, payload) VALUES ($1, $2, $3)
     ON CONFLICT (payment_id, payment_status) DO NOTHING RETURNING id`,
    [paymentId, paymentStatus, JSON.stringify(payload)]
  );
  if (!inserted) {
    return NextResponse.json({ ok: true, note: 'already processed' });
  }

  try {
    // Per NOWPayments' own integration guidance: do not grant goods/keys
    // on 'confirming' or 'confirmed' — only 'finished' means the funds
    // have actually settled. Everything else is just a status update we
    // log but don't act on.
    if (paymentStatus === 'finished') {
      await activateKeyForCryptoPurchase(paymentId);
    } else if (paymentStatus === 'failed' || paymentStatus === 'expired') {
      await query(`UPDATE purchases SET status = 'cancelled' WHERE crypto_payment_id = $1 AND status = 'pending'`, [paymentId]);
    } else if (paymentStatus === 'refunded') {
      const purchase = await queryOne<{ id: string; key_id: string | null }>(
        `SELECT id, key_id FROM purchases WHERE crypto_payment_id = $1`,
        [paymentId]
      );
      if (purchase) {
        await query(`UPDATE purchases SET status = 'refunded' WHERE id = $1`, [purchase.id]);
        if (purchase.key_id) {
          await query(`UPDATE keys SET status = 'revoked', revoked_at = now() WHERE id = $1 AND status = 'active'`, [purchase.key_id]);
        }
      }
    }

    await query(`UPDATE crypto_payment_events SET processed_at = now() WHERE payment_id = $1 AND payment_status = $2`, [
      paymentId,
      paymentStatus,
    ]);
  } catch (err) {
    console.error('[emblem] Crypto webhook processing error', err);
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
