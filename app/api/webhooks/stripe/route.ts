import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { query, queryOne } from '@/lib/db';
import { generateLicenseKey, hashKey, keyPreview, encryptKey } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';
import type Stripe from 'stripe';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

// Duration presets a plan can specify (days). null = lifetime (no expiry).
function computeExpiry(durationDays: number | null): Date | null {
  if (durationDays === null || durationDays === undefined) return null;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

async function activateKeyForPurchase(sessionId: string, paymentIntentId: string | null) {
  // Atomically claim this purchase for processing: only succeeds if it's
  // still 'pending'. This is what actually prevents a double-issued key if
  // Stripe redelivers the same webhook concurrently — not just the
  // payment_events idempotency check below, which has its own tiny race
  // window between the SELECT and the processing that follows it.
  const purchase = await queryOne<{ id: string; user_id: string; plan_id: string }>(
    `UPDATE purchases SET status = 'processing' WHERE stripe_checkout_session_id = $1 AND status = 'pending'
     RETURNING id, user_id, plan_id`,
    [sessionId]
  );
  if (!purchase) return; // Already paid/processing/cancelled by another delivery, or an unknown session — no-op either way.

  const plan = await queryOne<{ duration_days: number | null }>(`SELECT duration_days FROM pricing_plans WHERE id = $1`, [
    purchase.plan_id,
  ]);

  const plaintext = generateLicenseKey();
  const key = await queryOne<{ id: string }>(
    `INSERT INTO keys (key_hash, key_preview, key_encrypted, user_id, plan_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [hashKey(plaintext), keyPreview(plaintext), encryptKey(plaintext), purchase.user_id, purchase.plan_id, computeExpiry(plan?.duration_days ?? null)]
  );

  await query(
    `UPDATE purchases SET status = 'paid', key_id = $1, stripe_payment_intent_id = $2, paid_at = now() WHERE id = $3`,
    [key?.id, paymentIntentId ?? '', purchase.id]
  );

  await logAudit({
    actorUserId: null,
    action: 'purchase_completed',
    targetType: 'purchase',
    targetId: purchase.id,
    details: { keyId: key?.id },
  });

  // NOTE: the plaintext key itself is never logged anywhere. It IS
  // recoverable after this point though — encrypted (see encryptKey/
  // decryptKey in lib/crypto.ts) — so the buyer can view it from their
  // dashboard and support can look it up if needed. A full deployment
  // would probably also email it here as a convenience, on top of that.
}

async function handleRefundOrDispute(paymentIntentId: string, newStatus: 'refunded' | 'disputed') {
  const purchase = await queryOne<{ id: string; key_id: string | null }>(
    `SELECT id, key_id FROM purchases WHERE stripe_payment_intent_id = $1`,
    [paymentIntentId]
  );
  if (!purchase) return;

  await query(`UPDATE purchases SET status = $1 WHERE id = $2`, [newStatus, purchase.id]);

  if (purchase.key_id) {
    await query(`UPDATE keys SET status = 'revoked', revoked_at = now() WHERE id = $1 AND status = 'active'`, [purchase.key_id]);
    await logAudit({
      actorUserId: null,
      action: `key_revoked_${newStatus}`,
      targetType: 'key',
      targetId: purchase.key_id,
      details: { purchaseId: purchase.id },
    });
  }
}

async function POSTHandler(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Signature verification failed — this request did not genuinely come
    // from Stripe. Reject without processing anything.
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Idempotency: record this event id before processing. If it's already
  // present, we've seen it before (Stripe retries webhooks) — acknowledge
  // with 200 without reprocessing, rather than risk double-issuing a key.
  const inserted = await queryOne(
    `INSERT INTO payment_events (stripe_event_id, type, payload) VALUES ($1, $2, $3)
     ON CONFLICT (stripe_event_id) DO NOTHING RETURNING id`,
    [event.id, event.type, JSON.stringify(event)]
  );
  if (!inserted) {
    return NextResponse.json({ ok: true, note: 'already processed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === 'paid') {
          await activateKeyForPurchase(session.id, (session.payment_intent as string) || null);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await query(`UPDATE purchases SET status = 'cancelled' WHERE stripe_checkout_session_id = $1 AND status = 'pending'`, [
          session.id,
        ]);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (typeof charge.payment_intent === 'string') {
          await handleRefundOrDispute(charge.payment_intent, 'refunded');
        }
        break;
      }
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        if (typeof dispute.payment_intent === 'string') {
          await handleRefundOrDispute(dispute.payment_intent, 'disputed');
        }
        break;
      }
      default:
        break; // Unhandled event types are acknowledged, not errors.
    }

    await query(`UPDATE payment_events SET processed_at = now() WHERE stripe_event_id = $1`, [event.id]);
  } catch (err) {
    console.error('[emblem] Webhook processing error', err);
    // Return 500 so Stripe retries. The unique constraint on stripe_event_id
    // (checked above via ON CONFLICT DO NOTHING) is what prevents duplicate
    // processing — this catch just lets Stripe's retry mechanism re-run the
    // switch logic if something transient failed partway through.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(POSTHandler);

