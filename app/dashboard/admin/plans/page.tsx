'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { formatPrice } from '@/lib/format';

type Plan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  duration_days: number | null;
  stripe_price_id: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

const DURATION_PRESETS = [
  { label: 'Daily', days: 1 },
  { label: 'Weekly', days: 7 },
  { label: 'Monthly', days: 30 },
  { label: 'Lifetime', days: null },
];

export default function AdminPlansPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [plans, setPlans] = useState<Plan[] | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [features, setFeatures] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/plans');
    const data = await res.json();
    setPlans(data.plans ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!name || isNaN(priceCents) || priceCents <= 0) {
      toast.push('Enter a name and a valid price.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          priceCents,
          durationDays: duration,
          features: features.split('\n').map((f) => f.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not create plan.', 'error');
        return;
      }
      toast.push('Plan created.', 'success');
      setName('');
      setDescription('');
      setPrice('');
      setDuration(null);
      setFeatures('');
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(plan: Plan) {
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !plan.is_active }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.push(data.error || 'Could not update plan.', 'error');
      return;
    }
    load();
  }

  async function deletePlan(plan: Plan) {
    if (!(await confirm(`Delete "${plan.name}"? This can't be undone.`, { danger: true, confirmLabel: 'Delete' }))) return;
    const res = await fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      toast.push(data.error || 'Could not delete plan.', 'error');
      return;
    }
    toast.push('Plan deleted.', 'success');
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Pricing plans</h1>
      <p className="mt-1 text-sm text-neutral-400">
        These prices are what customers see on <a href="/pricing" className="text-ink underline">/pricing</a> and pay
        through <em>any</em> of the three payment methods (card, crypto, PayPal) — the price here is the single
        source of truth regardless of how someone pays.
      </p>

      <form onSubmit={createPlan} className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <h2 className="font-bold text-ink">Add a plan</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Weekly)"
            required
            className={inputClass}
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price in dollars (e.g. 4.99)"
            inputMode="decimal"
            required
            className={inputClass}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-neutral-400">Duration</p>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDuration(p.days)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  duration === p.days ? 'border-ink bg-ink text-paper' : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description shown under the price"
          className={inputClass}
        />
        <textarea
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          placeholder={'One feature per line, e.g.\nFull script access\nPriority support'}
          rows={3}
          className={inputClass}
        />

        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-200 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Add plan'}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {plans === null ? (
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
        ) : plans.length === 0 ? (
          <p className="text-sm text-neutral-400">No plans yet — add one above.</p>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{p.name}</span>
                  <span className="text-sm text-neutral-400">
                    {formatPrice(p.price_cents, p.currency)} · {p.duration_days ? `${p.duration_days}d` : 'Lifetime'}
                  </span>
                  {!p.is_active && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                      Hidden
                    </span>
                  )}
                </div>
                {p.description && <p className="mt-0.5 text-sm text-neutral-400">{p.description}</p>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => toggleActive(p)}
                  className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-white/[0.05]"
                >
                  {p.is_active ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => deletePlan(p)}
                  className="rounded-md border border-red-500/30 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30';
