'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type ConfigRow = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  download_count: number;
  created_at: string;
  author: string;
};

const POPULAR_TAGS = ['rage', 'legit', 'aimbot', 'esp', 'movement', 'visuals', 'combat', 'silent-aim'];

export function MarketplaceClient() {
  const [configs, setConfigs] = useState<ConfigRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<'popular' | 'new'>('popular');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (activeTag) params.set('tag', activeTag);
    params.set('sort', sort);
    const res = await fetch(`/api/marketplace?${params.toString()}`);
    const data = await res.json();
    setConfigs(data.configs ?? []);
  }, [query, activeTag, sort]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const maxDownloads = configs && configs.length > 0 ? Math.max(...configs.map((c) => c.download_count), 1) : 1;

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        {/* Left: intro + search + tag filters — sticky, asymmetric against the results on the right */}
        <div className="lg:sticky lg:top-28 lg:col-span-4 lg:h-fit">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Community</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Marketplace</h1>
          <p className="mt-4 max-w-sm text-sm text-neutral-400">
            Configs uploaded by other users — browse, search, and load them straight into your own menu. Upload your own
            from your dashboard.
          </p>

          <div className="mt-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search configs..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-signal/40"
            />
          </div>

          <div className="mt-4 flex gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-1">
            {(['popular', 'new'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition ${
                  sort === s ? 'bg-signal/15 text-signal' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  activeTag === tag
                    ? 'border-signal/40 bg-signal/10 text-signal'
                    : 'border-white/10 text-neutral-400 hover:bg-white/[0.04] hover:text-ink'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <Link
            href="/dashboard/marketplace"
            className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-signal px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-signal/90"
          >
            Upload a config
          </Link>
        </div>

        {/* Right: results as spec-sheet rows — download count reads as a
            small inline bar rather than just a number, and tags/author sit
            inline in one line instead of stacked, closer to a real
            marketplace list than a set of generic cards. */}
        <div className="lg:col-span-8">
          {configs === null ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
              ))}
            </div>
          ) : configs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
              <p className="text-neutral-400">No configs found.</p>
              {(query || activeTag) && (
                <button
                  onClick={() => {
                    setQuery('');
                    setActiveTag(null);
                  }}
                  className="mt-3 text-sm font-semibold text-signal underline underline-offset-4"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {configs.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/marketplace/${c.id}`}
                  className={`group flex items-center gap-5 bg-white/[0.02] p-5 transition hover:bg-white/[0.04] ${
                    i !== 0 ? 'border-t border-white/[0.08]' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-ink">{c.name}</h3>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-neutral-600">by {c.author}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-neutral-400">{c.description || 'No description.'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="hidden w-24 shrink-0 sm:block">
                    <div className="font-mono text-lg font-bold text-signal">{c.download_count}</div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full bg-signal" style={{ width: `${Math.max((c.download_count / maxDownloads) * 100, 4)}%` }} />
                    </div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-neutral-600">downloads</div>
                  </div>
                  <span className="shrink-0 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-signal" aria-hidden>→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
