'use client';

import { useEffect, useState } from 'react';

type Analytics = {
  totals: Record<string, string>;
  activeUsersThisWeek: string;
  topKeys: { key_preview: string; usage_count: number; owner_username: string | null }[];
  topVersions: { version: string; fetches: string }[];
  rateLimitEvents: { bucket: string; hits: string }[];
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />;

  const cards = [
    { label: 'Total executions', value: data.totals.total_executions },
    { label: 'Today', value: data.totals.today },
    { label: 'This week', value: data.totals.this_week },
    { label: 'This month', value: data.totals.this_month },
    { label: 'Active keys (7d)', value: data.activeUsersThisWeek },
    { label: 'Failed auth (7d)', value: data.totals.failed_auth },
    { label: 'Revoked-key attempts (7d)', value: data.totals.revoked_attempts },
    { label: 'Replay attempts blocked (7d)', value: data.totals.replay_blocked },
  ];

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Analytics</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-2xl font-black text-ink">{c.value}</div>
            <div className="mt-1 text-xs text-neutral-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="font-bold text-ink">Top keys by usage</h2>
          <div className="mt-3 space-y-2">
            {data.topKeys.map((k) => (
              <div key={k.key_preview} className="flex items-center justify-between text-sm">
                <span className="font-mono text-neutral-300">{k.key_preview}</span>
                <span className="text-neutral-400">
                  {k.owner_username || '—'} · {k.usage_count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="font-bold text-ink">Top versions</h2>
          <div className="mt-3 space-y-2">
            {data.topVersions.map((v) => (
              <div key={v.version} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">v{v.version}</span>
                <span className="text-neutral-400">{v.fetches}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <h2 className="font-bold text-ink">Rate-limit activity (24h)</h2>
        <div className="mt-3 space-y-1.5">
          {data.rateLimitEvents.map((r) => (
            <div key={r.bucket} className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs text-neutral-400">{r.bucket}</span>
              <span className="text-neutral-400">{r.hits} hits</span>
            </div>
          ))}
          {data.rateLimitEvents.length === 0 && <p className="text-sm text-neutral-400">No rate-limit activity in the last 24 hours.</p>}
        </div>
      </div>
    </div>
  );
}
