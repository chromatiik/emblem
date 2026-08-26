import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { decryptKey } from '@/lib/crypto';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { rows } = await query<{ id: string; key_encrypted: string; [key: string]: any }>(
    `SELECT id, key_preview, key_encrypted, status, hwid_hash IS NOT NULL AS hwid_bound, hwid_bound_at,
            hwid_reset_count, hwid_last_reset_at, usage_count, last_used_at,
            last_roblox_username, expires_at, created_at
     FROM keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [auth.id]
  );

  const keysWithPlaintext = rows.map(({ key_encrypted, ...row }) => {
    let key = null;
    if (key_encrypted) {
      try {
        key = decryptKey(key_encrypted);
      } catch {
        key = null;
      }
    }
    return { ...row, key };
  });

  return NextResponse.json({ keys: keysWithPlaintext });
}

export const GET = withErrorHandling(GETHandler);

