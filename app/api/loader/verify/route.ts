import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { hashKey, hashHwid } from '@/lib/crypto';
import { getRequestIp, getRequestIpHash } from '@/lib/audit';
import { isRateLimited } from '@/lib/rateLimit';
import { isIpBanned } from '@/lib/ipban';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const bodySchema = z.object({
  key: z.string().min(10).max(64),
  hwid: z.string().min(4).max(200),
});

/**
 * Lets an already-delivered payload re-confirm its own key is still valid,
 * independent of the original loader handshake. This exists specifically
 * so a copy of the decrypted payload, if it ever ended up outside the
 * normal loadstring flow (saved to disk, shared, re-run standalone),
 * still can't run without an active key check passing — it's not a
 * replacement for /api/loader/auth (which remains the only way to obtain
 * the payload in the first place), it's a second, independent check that
 * the payload itself performs once it's already running.
 *
 * Deliberately does NOT bind or update HWID here, and does NOT accept a
 * nonce or issue a session token — this only confirms current validity,
 * it doesn't grant anything new. First-use HWID binding still only
 * happens through the real handshake in /api/loader/auth.
 */
async function POSTHandler(req: Request) {
  const ip = getRequestIp(req);
  const ipHash = getRequestIpHash(req);

  if (await isIpBanned(ip)) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }

  if (await isRateLimited(`loader_verify_ip:${ipHash}`, 60, 60)) {
    return NextResponse.json({ valid: false, error: 'rate_limited' }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const keyHash = hashKey(body.key);
  const keyRow = await queryOne<{ id: string; status: string; hwid_hash: string | null; expires_at: string | null }>(
    `SELECT id, status, hwid_hash, expires_at FROM keys WHERE key_hash = $1`,
    [keyHash]
  );

  if (!keyRow || keyRow.status !== 'active') {
    return NextResponse.json({ valid: false });
  }

  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    await query(`UPDATE keys SET status = 'expired' WHERE id = $1 AND status = 'active'`, [keyRow.id]);
    return NextResponse.json({ valid: false });
  }

  const hwidHash = hashHwid(body.hwid);
  if (keyRow.hwid_hash && keyRow.hwid_hash !== hwidHash) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true });
}

export const POST = withErrorHandling(POSTHandler);
