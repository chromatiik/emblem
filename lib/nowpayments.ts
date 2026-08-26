import 'server-only';
import crypto from 'crypto';

const API_BASE = 'https://api.nowpayments.io/v1';

interface CreatePaymentParams {
  priceAmount: number; // in the given currency's major unit, e.g. dollars
  priceCurrency: string; // e.g. 'usd'
  payCurrency: string; // e.g. 'btc', 'eth', 'usdttrc20'
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
}

export interface NowPaymentsPayment {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id: string;
}

export async function createCryptoPayment(params: CreatePaymentParams): Promise<NowPaymentsPayment> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error('[emblem] NOWPAYMENTS_API_KEY is not set.');

  const res = await fetch(`${API_BASE}/payment`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: params.priceAmount,
      price_currency: params.priceCurrency,
      pay_currency: params.payCurrency,
      order_id: params.orderId,
      order_description: params.orderDescription,
      ipn_callback_url: params.ipnCallbackUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[emblem] NOWPayments createPayment failed: ${res.status} ${body}`);
  }

  return res.json();
}

export async function getCryptoPaymentStatus(paymentId: string): Promise<NowPaymentsPayment> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error('[emblem] NOWPAYMENTS_API_KEY is not set.');

  const res = await fetch(`${API_BASE}/payment/${paymentId}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`[emblem] NOWPayments getPaymentStatus failed: ${res.status}`);
  return res.json();
}

/**
 * Recursively sorts object keys — NOWPayments' signature is computed over
 * the JSON-stringified payload with keys sorted at EVERY level, not just
 * the top level. Getting this wrong means every signature check silently
 * fails, which is easy to miss in testing if you only try shallow objects.
 */
function sortObjectDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortObjectDeep(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

export function verifyIpnSignature(rawBody: any, signature: string): boolean {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!ipnSecret) throw new Error('[emblem] NOWPAYMENTS_IPN_SECRET is not set.');

  const sorted = sortObjectDeep(rawBody);
  const hmac = crypto.createHmac('sha512', ipnSecret);
  hmac.update(JSON.stringify(sorted));
  const expected = hmac.digest('hex');

  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
