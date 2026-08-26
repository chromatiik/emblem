import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { hashToken } from '@/lib/crypto';
import { getRequestIpHash, looksLikeBrowser } from '@/lib/audit';
import { isRateLimited } from '@/lib/rateLimit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

const bodySchema = z.object({
  sessionToken: z.string().min(32).max(128),
});

async function POSTHandler(req: Request) {
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
  //
  // Run this alongside the payload fetch rather than before it — neither
  // depends on the other's result, and the payload fetch (a full script,
  // ~800KB of text) is likely the single slowest step in the entire
  // loader flow. If the session turns out to be invalid, the fetched
  // payload is just discarded, which costs far less than making every
  // successful request wait for these two full round-trips in series.
  const [consumed, version] = await Promise.all([
    queryOne<{ key_id: string; hwid_hash: string | null }>(
      `UPDATE key_sessions
       SET status = 'consumed', consumed_at = now()
       WHERE token_hash = $1 AND status = 'issued' AND expires_at > now()
       RETURNING key_id, hwid_hash`,
      [tokenHash]
    ),
    queryOne<{ id: string; payload: string }>(
      `SELECT id, payload FROM script_versions WHERE is_enabled = TRUE ORDER BY created_at DESC LIMIT 1`
    ),
  ]);

  if (!consumed) {
    return new NextResponse('', { status: 401 });
  }

  // Soft, logged-only signal — never the actual gate (see lib/audit.ts).
  const flaggedAsBrowser = looksLikeBrowser(req.headers.get('user-agent'));

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

  // Streamed rather than returned as a single buffered string. Vercel's
  // hard 4.5MB limit applies specifically to buffered response bodies -
  // streaming responses are documented as exempt from it. This matters
  // because obfuscation (especially VM-based) can inflate a script's size
  // dramatically, and an obfuscated payload could plausibly exceed that
  // limit even when the original source doesn't - which would silently
  // truncate the response before it ever reaches the loader, producing
  // exactly the kind of "incomplete script" parse error this is fixing.
  const payloadBytes = new TextEncoder().encode(version.payload);
  const chunkSize = 65536;
  const stream = new ReadableStream({
    start(controller) {
      let offset = 0;
      function push() {
        if (offset >= payloadBytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(payloadBytes.subarray(offset, offset + chunkSize));
        offset += chunkSize;
        push();
      }
      push();
    },
  });

  return new NextResponse(stream, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export const POST = withErrorHandling(POSTHandler);

