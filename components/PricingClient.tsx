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

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-24">
      <p className="text-center font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Get access</p>
      <h1 className="mt-3 text-center text-4xl font-black text-ink">Pricing</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-neutral-400">
        Every plan includes the same protected delivery — key auth, HWID binding, replay protection.
      </p>

      {loadError ? (
        <div className="mt-16 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <p className="font-semibold text-red-400">Couldn&apos;t load pricing right now.</p>
          <p className="mt-1 text-sm text-red-400/80">
            This usually means the database isn&apos;t reachable — check <code>DATABASE_URL</code> in your environment.
          </p>
        </div>
      ) : plans === null ? (
        <div className="mt-16 grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <p className="mt-16 text-center text-neutral-400">No plans are configured yet — check back soon.</p>
      ) : (
        <div className="mt-16 grid gap-5 sm:grid-cols-3">
          {plans.map((p, i) => (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border p-7 backdrop-blur ${
                i === 1 ? 'border-signal/30 bg-signal/[0.04]' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              {i === 1 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-paper">
                  Popular
                </span>
              )}
              <div className="font-bold text-ink">{p.name}</div>
              <div className="mt-2 font-mono text-4xl font-bold tracking-tight text-ink">{formatPrice(p.price_cents, p.currency)}</div>
              <div className="mt-1 font-mono text-xs uppercase tracking-wide text-neutral-500">{p.duration_days ? `${p.duration_days} days` : 'Lifetime'}</div>
              {p.description && <p className="mt-4 text-sm text-neutral-400">{p.description}</p>}
              {p.features?.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-signal">✓</span> {f}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => buy(p.id)}
                className={`mt-6 rounded-xl py-3 text-sm font-bold transition ${
                  i === 1 ? 'bg-signal text-paper hover:bg-signal/90' : 'border border-white/15 text-ink hover:bg-white/[0.06]'
                }`}
              >
                Get this plan
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
