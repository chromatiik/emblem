import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export const runtime = 'nodejs';

// 2FA enrollment is restricted to admin/owner accounts — matching the
// spec's requirement that admin auth specifically be "significantly
// protected." A secret is generated and stored, but totp_enabled stays
// false until the user proves they can produce a valid code for it via
// /api/auth/totp/enable — otherwise a user who never finishes setup could
// lock themselves out with a half-configured secret.
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const secret = authenticator.generateSecret();
  await query(`UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2`, [secret, auth.id]);

  const otpauth = authenticator.keyuri(auth.email, process.env.SITE_NAME || 'Emblem', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  return NextResponse.json({ secret, qrCodeDataUrl });
}
