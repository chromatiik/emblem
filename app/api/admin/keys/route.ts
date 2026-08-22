import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { generateLicenseKey, hashKey, keyPreview } from '@/lib/crypto';
import { logAudit, getRequestIpHash } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: Request) {
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

  const { rows } = await query(
    `SELECT keys.id, keys.key_preview, keys.status, keys.hwid_hash IS NOT NULL AS hwid_bound,
            keys.usage_count, keys.last_used_at, keys.last_roblox_username, keys.expires_at,
            keys.admin_notes, keys.created_at, users.username AS owner_username, users.email AS owner_email
     FROM keys LEFT JOIN users ON users.id = keys.user_id
     ${where}
     ORDER BY keys.created_at DESC LIMIT 300`,
    params
  );

  return NextResponse.json({ keys: rows });
}

const createSchema = z.object({
  userEmail: z.string().email().optional(),
  durationDays: z.number().int().positive().optional(), // omit for lifetime
  note: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  let userId: string | null = null;
  if (body.userEmail) {
    const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [body.userEmail.toLowerCase()]);
    if (!user) return NextResponse.json({ error: 'No account with that email.' }, { status: 404 });
    userId = user.id;
  }

  const plaintext = generateLicenseKey();
  const expiresAt = body.durationDays ? new Date(Date.now() + body.durationDays * 86400000) : null;

  const key = await queryOne<{ id: string }>(
    `INSERT INTO keys (key_hash, key_preview, user_id, expires_at, admin_notes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [hashKey(plaintext), keyPreview(plaintext), userId, expiresAt, body.note ?? '']
  );

  await logAudit({
    actorUserId: auth.id,
    action: 'key_created',
    targetType: 'key',
    targetId: key?.id,
    details: { userEmail: body.userEmail ?? null, durationDays: body.durationDays ?? null },
    ipHash: getRequestIpHash(req),
  });

  // The plaintext key is returned exactly once, here, to the admin who
  // generated it — it is never stored or retrievable again afterward.
  return NextResponse.json({ id: key?.id, plaintextKey: plaintext });
}
