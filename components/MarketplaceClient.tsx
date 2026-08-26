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

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        {/* Left: intro + search + tag filters — sticky, asymmetric against the results on the right */}
        <div className="lg:sticky lg:top-28 lg:col-span-4 lg:h-fit">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Community</p>
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
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-white/25"
            />
          </div>

          <div className="mt-4 flex gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-1">
            {(['popular', 'new'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition ${
                  sort === s ? 'bg-white/[0.09] text-ink' : 'text-neutral-500 hover:text-neutral-300'
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
                    ? 'border-white/25 bg-white/[0.09] text-ink'
                    : 'border-white/10 text-neutral-400 hover:bg-white/[0.04] hover:text-ink'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <Link
            href="/dashboard/marketplace"
            className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-200"
          >
            Upload a config
          </Link>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-8">
          {configs === null ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
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
                  className="mt-3 text-sm font-semibold text-ink underline underline-offset-4"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {configs.map((c) => (
                <Link
                  key={c.id}
                  href={`/marketplace/${c.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-ink">{c.name}</h3>
                    <span className="shrink-0 font-mono text-xs text-neutral-500">↓{c.download_count}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-neutral-400">{c.description || 'No description.'}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-neutral-600">by {c.author}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
