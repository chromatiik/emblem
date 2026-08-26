import { NextResponse } from 'next/server';
import { z } from 'zod';
import { gunzipSync } from 'zlib';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { setConfig } from '@/lib/config';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  // Payload is deliberately excluded from the list response — even admins
  // only see it when they explicitly open a specific version, not in a
  // bulk listing that might get logged/screenshotted/cached carelessly.
  const { rows } = await query(
    `SELECT id, version, release_notes, is_enabled, supported_executors, created_at,
            (SELECT username FROM users WHERE users.id = script_versions.created_by) AS created_by_username,
            length(payload) AS payload_length
     FROM script_versions ORDER BY created_at DESC LIMIT 100`
  );

  return NextResponse.json({ versions: rows });
}

const createSchema = z.object({
  version: z.string().min(1).max(30),
  releaseNotes: z.string().max(2000).optional(),
  payloadGzipBase64: z.string().min(1),
  supportedExecutors: z.array(z.string().max(40)).max(20).optional(),
  enableImmediately: z.boolean().optional(),
});

export const GET = withErrorHandling(GETHandler);

async function POSTHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let raw: z.infer<typeof createSchema>;
  try {
    raw = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  let payload: string;
  try {
    payload = gunzipSync(Buffer.from(raw.payloadGzipBase64, 'base64')).toString('utf-8');
  } catch {
    return NextResponse.json({ error: 'Could not decompress payload — try uploading again.' }, { status: 400 });
  }
  if (payload.length < 1 || payload.length > 20_000_000) {
    return NextResponse.json({ error: 'Decompressed payload is empty or too large.' }, { status: 400 });
  }

  const body = { ...raw, payload };

  const version = await queryOne<{ id: string }>(
    `INSERT INTO script_versions (version, release_notes, payload, supported_executors, created_by, is_enabled)
     VALUES ($1,$2,$3,$4,$5,FALSE) RETURNING id`,
    [body.version, body.releaseNotes ?? '', body.payload, body.supportedExecutors ?? [], auth.id]
  );

  if (body.enableImmediately && version) {
    await query(`UPDATE script_versions SET is_enabled = FALSE WHERE is_enabled = TRUE`);
    await query(`UPDATE script_versions SET is_enabled = TRUE WHERE id = $1`, [version.id]);
    await setConfig('current_version', body.version);
  }

  await logAudit({
    actorUserId: auth.id,
    action: 'script_version_uploaded',
    targetType: 'script_version',
    targetId: version?.id,
    details: { version: body.version, enabled: Boolean(body.enableImmediately) },
    ipHash: getRequestIpHash(req),
  });

  return NextResponse.json({ id: version?.id });
}

export const POST = withErrorHandling(POSTHandler);

