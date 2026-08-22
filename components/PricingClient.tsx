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
      <h1 className="text-center text-4xl font-black text-ink">Pricing</h1>
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
              className={`flex flex-col rounded-2xl border p-7 backdrop-blur ${
                i === 1 ? 'border-white/15 bg-white/[0.03]' : 'border-white/10 bg-white/[0.035]'
              }`}
            >
              <div className="font-bold text-ink">{p.name}</div>
              <div className="mt-2 text-4xl font-black text-ink">{formatPrice(p.price_cents, p.currency)}</div>
              <div className="mt-1 text-xs text-neutral-400">{p.duration_days ? `${p.duration_days} days` : 'Lifetime'}</div>
              {p.description && <p className="mt-4 text-sm text-neutral-400">{p.description}</p>}
              {p.features?.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-ink">✓</span> {f}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => buy(p.id)}
                className="mt-6 rounded-xl bg-ink py-3 text-sm font-bold text-paper transition hover:bg-neutral-800"
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
