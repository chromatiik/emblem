import crypto from 'crypto';

// ---------------------------------------------------------------------------
// License keys — e.g. EMBLEM-8F2K-93QZ-4RXT-M2WP
// Only the SHA-256 hash is ever stored; the plaintext is shown to the buyer
// exactly once (at generation/purchase time) and never persisted.
// ---------------------------------------------------------------------------
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

export function generateLicenseKey(): string {
  const group = () =>
    Array.from({ length: 4 }, () => KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)]).join('');
  return `EMBLEM-${group()}-${group()}-${group()}-${group()}`;
}

export function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext.trim().toUpperCase()).digest('hex');
}

export function keyPreview(plaintext: string): string {
  const parts = plaintext.split('-');
  const last = parts[parts.length - 1] ?? '????';
  return `EMBLEM-••••-••••-••••-${last}`;
}

// ---------------------------------------------------------------------------
// HWID hashing — we never see the raw hardware identifier in a form that's
// useful outside this app: it's hashed with a server-side pepper before
// storage or comparison, so a leaked database alone doesn't hand out raw
// device identifiers.
// ---------------------------------------------------------------------------
export function hashHwid(rawHwid: string): string {
  const pepper = process.env.HWID_HASH_PEPPER || '';
  if (!pepper) throw new Error('[emblem] HWID_HASH_PEPPER is not set.');
  return crypto.createHash('sha256').update(pepper).update(rawHwid.trim()).digest('hex');
}

// ---------------------------------------------------------------------------
// Session / loader tokens — random, opaque, stored server-side only as a
// hash (same pattern as passwords: even a full DB dump doesn't hand out
// usable tokens).
// ---------------------------------------------------------------------------
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// IP hashing for logs — we store a salted hash rather than a raw IP so
// audit/usage tables aren't a directory of everyone's real IP addresses,
// while still letting us correlate repeated abuse from the same source.
// ---------------------------------------------------------------------------
export function hashIp(ip: string): string {
  const pepper = process.env.HWID_HASH_PEPPER || '';
  return crypto.createHash('sha256').update(pepper).update(ip).digest('hex').slice(0, 24);
}

// ---------------------------------------------------------------------------
// Constant-time string comparison (for nonce/token checks where timing
// differences could leak information — belt-and-suspenders since we also
// look these up by hash, which already collapses timing signal).
// ---------------------------------------------------------------------------
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
