import 'server-only';

interface WeaoExploit {
  title: string;
  suncPercentage?: number;
  updateStatus: boolean;
  detected: boolean;
  free: boolean;
  platform: string;
}

/**
 * Live executor names with sUNC > 90, sourced from WEAO's public API.
 *
 * Deliberately conservative with outbound requests: this is a public site
 * on a tight bandwidth/compute budget, so we can't afford to hit WEAO on
 * every single pageview. Next's fetch cache with `revalidate: 3600` means
 * WEAO gets called at most once an hour total, no matter how much traffic
 * the landing page gets in between — everyone else gets the cached result
 * straight from Next's data cache, which costs us nothing.
 *
 * Falls back to a small static list if the request fails for any reason
 * (WEAO down, rate limited, network hiccup) so the page never breaks or
 * shows nothing because of a third party.
 */
export async function getWorkingExecutors(): Promise<string[]> {
  const FALLBACK = ['Xeno', 'Solara', 'Wave', 'Delta'];

  try {
    const res = await fetch('https://weao.xyz/api/status/exploits', {
      headers: { 'User-Agent': 'WEAO-3PService' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return FALLBACK;

    const data: WeaoExploit[] = await res.json();
    if (!Array.isArray(data)) return FALLBACK;

    const working = data
      .filter((e) => typeof e.suncPercentage === 'number' && e.suncPercentage > 90 && e.updateStatus && e.platform === 'Windows')
      .sort((a, b) => (b.suncPercentage ?? 0) - (a.suncPercentage ?? 0))
      .slice(0, 8)
      .map((e) => e.title);

    return working.length > 0 ? working : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
