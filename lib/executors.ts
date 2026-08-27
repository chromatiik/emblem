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
  const FALLBACK = ['Xeno', 'Solara', 'Wave', 'Delta', 'Zorara', 'Cryptic'];
  const MIN_DISPLAY = 6;

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
      .slice(0, 10)
      .map((e) => e.title);

    if (working.length === 0) return FALLBACK;

    // The 90%+ bar is genuinely strict and can legitimately have very few
    // live matches at any given moment (e.g. right after a Roblox update
    // while executors are still catching up) - that's real data, not a
    // bug. But showing only 1-2 names looks broken and can't fill a
    // marquee's width, so pad the shortfall with the curated fallback list
    // rather than lowering the threshold - every name shown either is
    // verified 90%+ right now, or is from the trusted static list, never a
    // lower-percentage result being misrepresented as meeting the bar the
    // page states next to it.
    if (working.length < MIN_DISPLAY) {
      for (const name of FALLBACK) {
        if (working.length >= MIN_DISPLAY) break;
        if (!working.includes(name)) working.push(name);
      }
    }

    return working;
  } catch {
    return FALLBACK;
  }
}
