import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler(_req: Request, { params }: { params: { purchaseId: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const purchase = await queryOne<{ status: string; key_id: string | null }>(
    `SELECT status, key_id FROM purchases WHERE id = $1 AND user_id = $2`,
    [params.purchaseId, auth.id]
  );

  if (!purchase) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({ status: purchase.status, keyIssued: Boolean(purchase.key_id) });
}

export const GET = withErrorHandling(GETHandler);

