import 'server-only';

/**
 * Wraps getipintel.net's free proxy/VPN detection API. No API key or
 * signup required, but their terms require a real contact email on every
 * request — set VPN_CHECK_CONTACT_EMAIL in your environment to enable this
 * feature at all. Without it, checkIsVpn() always returns null (unknown)
 * and nothing else in the app is affected.
 *
 * Free tier is rate-limited to 15 requests/minute and ~500/day, with no
 * way to raise that limit short of contacting them directly — there is no
 * paid tier to fall back on. Every caller in this app respects that by
 * checking each IP at most once (see site_visitors.vpn_checked_at and the
 * override logic in recordUserIp), not on every request.
 */

const CONTACT_EMAIL = process.env.VPN_CHECK_CONTACT_EMAIL || '';

// Above this score (0-1), treat the IP as a VPN/proxy. getipintel's own
// sample code uses 0.99 as a "definitely block" threshold; 0.90 is looser,
// appropriate for a badge shown to an admin rather than an automatic block.
const VPN_THRESHOLD = 0.9;

/**
 * Returns true/false if the check succeeded, or null if the check
 * couldn't be completed (no contact email configured, rate-limited,
 * network error, invalid IP, etc). Never throws.
 */
export async function checkIsVpn(ip: string): Promise<boolean | null> {
  if (!CONTACT_EMAIL) return null;
  if (!ip || ip === '0.0.0.0' || ip === '::1' || ip === '127.0.0.1') return null;

  try {
    const url = `https://check.getipintel.net/check.php?ip=${encodeURIComponent(ip)}&contact=${encodeURIComponent(CONTACT_EMAIL)}&flags=m`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const text = (await res.text()).trim();
    const score = parseFloat(text);
    if (Number.isNaN(score) || score < 0) return null; // negative = error code from their API

    return score >= VPN_THRESHOLD;
  } catch {
    return null;
  }
}
