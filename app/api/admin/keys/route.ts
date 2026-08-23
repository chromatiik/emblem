import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { generateLicenseKey, hashKey, keyPreview, encryptKey, decryptKey } from '@/lib/crypto';
import { logAudit, getRequestIpHash } from '@/lib/audit';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const params: any[] = [];
  let where = '';
  if (status && ['active', 'revoked', 'banned', 'expired'].includes(status)) {
    params.push(status);
    where = `WHERE keys.status = $1`;
  }

  const { rows } = await query<{ id: string; key_preview: string; key_encrypted: string; [key: string]: any }>(
    `SELECT keys.id, keys.key_preview, keys.key_encrypted, keys.status, keys.hwid_hash IS NOT NULL AS hwid_bound,
            keys.usage_count, keys.last_used_at, keys.last_roblox_username, keys.expires_at,
            keys.admin_notes, keys.created_at, users.username AS owner_username, users.email AS owner_email
     FROM keys LEFT JOIN users ON users.id = keys.user_id
     ${where}
     ORDER BY keys.created_at DESC LIMIT 300`,
    params
  );

  const keysWithPlaintext = rows.map(({ key_encrypted, ...row }) => {
    let key = null;
    if (key_encrypted) {
      try {
        key = decryptKey(key_encrypted);
      } catch {
        key = null; // corrupted or encrypted under a since-rotated secret — fall back to the preview only
      }
    }
    return { ...row, key };
  });

  return NextResponse.json({ keys: keysWithPlaintext });
}

const createSchema = z.object({
  userId: z.string().uuid().optional(),
  userEmail: z.string().email().optional(),
  durationDays: z.number().int().positive().optional(), // omit for lifetime
  note: z.string().max(300).optional(),
});

export const GET = withErrorHandling(GETHandler);

async function POSTHandler(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  let userId: string | null = null;
  if (body.userId) {
    // Direct lookup — this is what the username/email search autocomplete
    // sends once a suggestion is picked, so it's exact rather than a
    // string match that could hit the wrong account.
    const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [body.userId]);
    if (!user) return NextResponse.json({ error: 'That account no longer exists.' }, { status: 404 });
    userId = user.id;
  } else if (body.userEmail) {
    const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [body.userEmail.toLowerCase()]);
    if (!user) return NextResponse.json({ error: 'No account with that email.' }, { status: 404 });
    userId = user.id;
  }

  const plaintext = generateLicenseKey();
  const expiresAt = body.durationDays ? new Date(Date.now() + body.durationDays * 86400000) : null;

  const key = await queryOne<{ id: string }>(
    `INSERT INTO keys (key_hash, key_preview, key_encrypted, user_id, expires_at, admin_notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [hashKey(plaintext), keyPreview(plaintext), encryptKey(plaintext), userId, expiresAt, body.note ?? '']
  );

  await logAudit({
    actorUserId: auth.id,
    action: 'key_created',
    targetType: 'key',
    targetId: key?.id,
    details: { userEmail: body.userEmail ?? null, durationDays: body.durationDays ?? null },
    ipHash: getRequestIpHash(req),
  });

  // Returned directly here too, but it's no longer the only time it's
  // visible — it's also decrypted and shown in the keys list above (GET),
  // since it's now stored encrypted rather than discarded after creation.
  return NextResponse.json({ id: key?.id, plaintextKey: plaintext });
}

export const POST = withErrorHandling(POSTHandler);

