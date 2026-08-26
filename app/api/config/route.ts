import { NextResponse } from 'next/server';
import { getPublicConfig } from '@/lib/config';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETHandler() {
  const config = await getPublicConfig();
  return NextResponse.json(config);
}

export const GET = withErrorHandling(GETHandler);

