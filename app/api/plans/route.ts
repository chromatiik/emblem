import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETHandler() {
  const { rows } = await query(
    `SELECT id, name, description, price_cents, currency, duration_days, features
     FROM pricing_plans WHERE is_active = TRUE ORDER BY sort_order ASC, price_cents ASC`
  );
  return NextResponse.json({ plans: rows });
}

export const GET = withErrorHandling(GETHandler);

