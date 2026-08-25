import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { hashKey, hashHwid, generateToken, hashToken } from '@/lib/crypto';
import { getRequestIp, getRequestIpHash } from '@/lib/audit';
import { isRateLimited } from '@/lib/rateLimit';
import { isIpBanned } from '@/lib/ipban';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const bodySchema = z.object({
  key: z.string().min(10).max(64),
  hwid: z.string().min(4).max(200),
  nonce: z.string().min(8).max(128),
  timestamp: z.number(),
  robloxUserId: z.string().max(32).optional(),
  robloxUsername: z.string().max(64).optional(),
});

// How far a client's timestamp is allowed to drift from server time. Wide
// enough to tolerate real clock skew, narrow enough to bound how long a
// captured request could theoretically be replayed before the nonce
// uniqueness check is the only thing stopping it (defense in depth on top
// of, not instead of, the nonce check).
const TIMESTAMP_WINDOW_SECONDS = 120;
const SESSION_TTL_SECONDS = 60;

async function logUsage(params: {
  keyId?: string | null;
  eventType: string;
  hwidHash?: string | null;
  robloxUserId?: string;
  robloxUsername?: string;
}) {
  await query(
    `INSERT INTO script_usage (key_id, event_type, hwid_hash, roblox_user_id, roblox_username) VALUES ($1,$2,$3,$4,$5)`,
    [params.keyId ?? null, params.eventType, params.hwidHash ?? null, params.robloxUserId ?? '', params.robloxUsername ?? '']
  );
}

async function POSTHandler(req: Request) {
  const ip = getRequestIp(req);
  const ipHash = getRequestIpHash(req);

  // These two only depend on the IP, which is available immediately —
  // no reason to wait on one before starting the other.
  const [banned, ipRateLimited] = await Promise.all([
    isIpBanned(ip),
    isRateLimited(`loader_auth_ip:${ipHash}`, 30, 60),
  ]);

  if (banned) {
    await logUsage({ eventType: 'ip_banned' });
    return NextResponse.json({ error: 'access_denied' }, { status: 403 });
  }

  if (ipRateLimited) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - body.timestamp) > TIMESTAMP_WINDOW_SECONDS) {
    return NextResponse.json({ error: 'timestamp_out_of_range' }, { status: 400 });
  }

  const keyHash = hashKey(body.key);

  // Same reasoning as the IP checks above — both only need keyHash, so
  // there's no reason to wait on the rate-limit query before starting the
  // key lookup. If rate-limited, the lookup result is just discarded.
  const [keyRateLimited, keyRow] = await Promise.all([
    isRateLimited(`loader_auth_key:${keyHash}`, 20, 60),
    queryOne<{
      id: string;
      status: string;
      hwid_hash: string | null;
      expires_at: string | null;
    }>(`SELECT id, status, hwid_hash, expires_at FROM keys WHERE key_hash = $1`, [keyHash]),
  ]);

  if (keyRateLimited) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  if (!keyRow) {
    await logUsage({ eventType: 'auth_fail' });
    return NextResponse.json({ error: 'invalid_key' }, { status: 401 });
  }

  if (keyRow.status === 'revoked' || keyRow.status === 'banned') {
    await logUsage({ keyId: keyRow.id, eventType: 'revoked_attempt' });
    return NextResponse.json({ error: 'key_unavailable' }, { status: 403 });
  }

  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    await query(`UPDATE keys SET status = 'expired' WHERE id = $1 AND status = 'active'`, [keyRow.id]);
    await logUsage({ keyId: keyRow.id, eventType: 'auth_fail' });
    return NextResponse.json({ error: 'key_expired' }, { status: 403 });
  }

  if (keyRow.status !== 'active') {
    await logUsage({ keyId: keyRow.id, eventType: 'auth_fail' });
    return NextResponse.json({ error: 'key_unavailable' }, { status: 403 });
  }

  const hwidHash = hashHwid(body.hwid);

  if (!keyRow.hwid_hash) {
    // First use: bind this HWID to the key.
    await query(`UPDATE keys SET hwid_hash = $1, hwid_bound_at = now() WHERE id = $2`, [hwidHash, keyRow.id]);
  } else if (keyRow.hwid_hash !== hwidHash) {
    await logUsage({ keyId: keyRow.id, eventType: 'auth_fail', hwidHash });
    return NextResponse.json({ error: 'hwid_mismatch' }, { status: 403 });
  }

  // Replay protection: a given nonce can only be used once per key. The
  // (key_id, nonce) unique index enforces this atomically — if a second
  // request races in with the same nonce, one of them will fail this
  // insert regardless of timing.
  const sessionToken = generateToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  try {
    await query(
      `INSERT INTO key_sessions (key_id, token_hash, nonce, hwid_hash, ip_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [keyRow.id, tokenHash, body.nonce, hwidHash, ipHash, expiresAt]
    );
  } catch (err: any) {
    if (err?.code === '23505') {
      // unique_violation on (key_id, nonce) — this exact request was seen before.
      await logUsage({ keyId: keyRow.id, eventType: 'replay_blocked', hwidHash });
      return NextResponse.json({ error: 'replay_detected' }, { status: 409 });
    }
    throw err;
  }

  // Both independent of each other's results, and neither's output is
  // needed for the response — no reason to run them one after another.
  await Promise.all([
    query(
      `UPDATE keys SET usage_count = usage_count + 1, last_used_at = now(),
         last_roblox_user_id = COALESCE(NULLIF($2, ''), last_roblox_user_id),
         last_roblox_username = COALESCE(NULLIF($3, ''), last_roblox_username)
       WHERE id = $1`,
      [keyRow.id, body.robloxUserId ?? '', body.robloxUsername ?? '']
    ),
    logUsage({
      keyId: keyRow.id,
      eventType: 'auth_success',
      hwidHash,
      robloxUserId: body.robloxUserId,
      robloxUsername: body.robloxUsername,
    }),
  ]);

  return NextResponse.json({ sessionToken, expiresIn: SESSION_TTL_SECONDS });
}

export const POST = withErrorHandling(POSTHandler);

