'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/format';

type Plan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  duration_days: number | null;
  features: string[];
};

const INCLUDED = [
  { label: 'Auth', title: 'Server-verified handshake', desc: 'Every execution round-trips through the auth server first — never a static file.' },
  { label: 'Device', title: 'HWID binding', desc: 'Keys bind to a device on first use. Reset it yourself from your dashboard.' },
  { label: 'Replay', title: 'Single-use nonce', desc: 'Every auth request is one-time — a captured request can\u2019t be replayed.' },
];

export function PricingClient() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/api/plans')
      .then(async (r) => {
        if (!r.ok) throw new Error(`API returned ${r.status}`);
        const data = await r.json();
        if (!Array.isArray(data.plans)) throw new Error('Unexpected response shape');
        setPlans(data.plans);
      })
      .catch(() => setLoadError(true));
  }, []);

  function buy(planId: string) {
    router.push(`/checkout?plan=${planId}`);
  }

  const popularIndex = plans && plans.length >= 2 ? 1 : -1;

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-24">
      <p className="text-center font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Get access</p>
      <h1 className="mt-3 text-center text-4xl font-black tracking-tight text-ink">Pick a duration.</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-neutral-400">
        Same protection on every plan — the only thing that changes is how long you&apos;re on it.
      </p>

      {loadError ? (
        <div className="mt-16 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <p className="font-semibold text-red-400">Couldn&apos;t load pricing right now.</p>
          <p className="mt-1 text-sm text-red-400/80">
            This usually means the database isn&apos;t reachable — check <code>DATABASE_URL</code> in your environment.
          </p>
        </div>
      ) : plans === null ? (
        <div className="mt-14 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <p className="mt-16 text-center text-neutral-400">No plans are configured yet — check back soon.</p>
      ) : (
        <>
          {/* Plans as a spec-sheet row list, not a card grid — the only
              real variable between plans is duration and price, so a list
              states that plainly instead of repeating the same features
              three times in three boxes. */}
          <div className="mt-14 overflow-hidden rounded-2xl border border-white/10">
            {plans.map((p, i) => {
              const isPopular = i === popularIndex;
              return (
                <div
                  key={p.id}
                  className={`flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between ${
                    i !== 0 ? 'border-t border-white/[0.08]' : ''
                  } ${isPopular ? 'relative bg-signal/[0.05]' : 'bg-white/[0.02]'}`}
                >
                  {isPopular && <span className="absolute inset-y-0 left-0 w-[3px] bg-signal" aria-hidden />}
                  <div className="flex items-baseline gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{p.name}</span>
                        {isPopular && (
                          <span className="rounded-full bg-signal px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-paper">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-xs uppercase tracking-wide text-neutral-500">
                        {p.duration_days ? `${p.duration_days} days` : 'Lifetime'}
                      </div>
                      {p.description && <p className="mt-1.5 max-w-xs text-sm text-neutral-400">{p.description}</p>}
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between gap-6 sm:w-auto">
                    <div className="font-mono text-3xl font-bold tracking-tight text-ink">
                      {formatPrice(p.price_cents, p.currency)}
                    </div>
                    <button
                      onClick={() => buy(p.id)}
                      className={`shrink-0 rounded-xl px-6 py-2.5 text-sm font-bold transition ${
                        isPopular ? 'bg-signal text-paper hover:bg-signal/90' : 'border border-white/15 text-ink hover:bg-white/[0.06]'
                      }`}
                    >
                      Get this plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* What's included — stated once, since every plan shares it,
              instead of repeated per-card checklists. */}
          <div className="mt-20">
            <p className="text-center font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Every plan includes</p>
            <div className="mx-auto mt-8 grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.08] sm:grid-cols-3">
              {INCLUDED.map((f) => (
                <div key={f.title} className="bg-paper p-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">{f.label}</span>
                  <h3 className="mt-2 font-bold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
