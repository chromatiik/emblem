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
// Reversible key storage — AES-256-GCM, keyed by a dedicated server secret
// (KEY_ENCRYPTION_SECRET, separate from HWID_HASH_PEPPER so rotating one
// doesn't affect the other). This exists specifically so admins/owners can
// look up a customer's actual key value (e.g. "I lost my key" support
// requests, or a buyer viewing their own key on their dashboard) without
// storing it as raw plaintext in the database. A database dump alone still
// isn't enough to recover keys — you'd also need this env var, which lives
// outside the database entirely. It's a real mitigation, not a formality,
// but it is not equivalent to the one-way hash used for authentication
// (hashKey/key_hash) — that remains the only thing the loader auth flow
// actually checks against.
// ---------------------------------------------------------------------------
function getEncryptionKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error('[emblem] KEY_ENCRYPTION_SECRET is not set.');
  return crypto.createHash('sha256').update(secret).digest(); // 32 bytes, correct for AES-256
}

export function encryptKey(plaintext: string): string {
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv : authTag : ciphertext, each hex-encoded and colon-joined for easy storage/parsing.
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptKey(stored: string): string {
  const [ivHex, authTagHex, cipherHex] = stored.split(':');
  if (!ivHex || !authTagHex || !cipherHex) throw new Error('[emblem] Malformed encrypted key value.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
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
