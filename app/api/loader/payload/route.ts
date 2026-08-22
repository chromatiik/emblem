import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { hashToken } from '@/lib/crypto';
import { getRequestIpHash, looksLikeBrowser } from '@/lib/audit';
import { isRateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  sessionToken: z.string().min(32).max(128),
});

export async function POST(req: Request) {
  const ipHash = getRequestIpHash(req);

  if (await isRateLimited(`loader_payload_ip:${ipHash}`, 30, 60)) {
    return new NextResponse('', { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return new NextResponse('', { status: 400 });
  }

  const tokenHash = hashToken(body.sessionToken);

  // Atomic single-use consumption: this UPDATE only succeeds once for a
  // given token. A second attempt to use the same token — whether replayed
  // by an attacker or raced by a buggy client — finds status != 'issued'
  // and returns nothing, so the payload is only ever handed out once per
  // successful auth handshake.
  const consumed = await queryOne<{ key_id: string; hwid_hash: string | null }>(
    `UPDATE key_sessions
     SET status = 'consumed', consumed_at = now()
     WHERE token_hash = $1 AND status = 'issued' AND expires_at > now()
     RETURNING key_id, hwid_hash`,
    [tokenHash]
  );

  if (!consumed) {
    return new NextResponse('', { status: 401 });
  }

  // Soft, logged-only signal — never the actual gate (see lib/audit.ts).
  const flaggedAsBrowser = looksLikeBrowser(req.headers.get('user-agent'));

  const version = await queryOne<{ id: string; payload: string }>(
    `SELECT id, payload FROM script_versions WHERE is_enabled = TRUE ORDER BY created_at DESC LIMIT 1`
  );

  if (!version) {
    return new NextResponse('', { status: 503 });
  }

  await query(
    `INSERT INTO script_usage (key_id, version_id, hwid_hash, event_type, key_session_id)
     SELECT $1, $2, $3, 'payload_fetch', ks.id FROM key_sessions ks WHERE ks.token_hash = $4`,
    [consumed.key_id, version.id, consumed.hwid_hash, tokenHash]
  );

  if (flaggedAsBrowser) {
    await query(`INSERT INTO security_events (event_type, ip_hash, details) VALUES ('browser_ua_on_payload', $1, $2)`, [
      ipHash,
      JSON.stringify({ note: 'Request completed the full auth handshake despite a browser-like User-Agent — logged for review, not blocked on this basis alone.' }),
    ]);
  }

  return new NextResponse(version.payload, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
