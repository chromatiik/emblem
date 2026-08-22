import 'server-only';

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[emblem] STRIPE_SECRET_KEY is not set — payments will not work until it is configured.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});
