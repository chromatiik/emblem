'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type KeyRow = {
  id: string;
  key_preview: string;
  status: string;
  hwid_bound: boolean;
  hwid_bound_at: string | null;
  hwid_reset_count: number;
  hwid_last_reset_at: string | null;
  usage_count: number;
  last_used_at: string | null;
  last_roblox_username: string | null;
  expires_at: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/keys');
    const data = await res.json();
    setKeys(data.keys ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function resetHwid(id: string) {
    if (!confirm('Reset the device bound to this key? You can only do this once a week per key.')) return;
    setResettingId(id);
    try {
      const res = await fetch(`/api/keys/${id}/hwid-reset`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not reset device.', 'error');
        return;
      }
      toast.push('Device reset. It will bind again on next use.', 'success');
      load();
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Your keys</h1>
      <p className="mt-1 text-sm text-neutral-400">Everything tied to your account.</p>

      {keys === null ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-neutral-400">No keys yet.</p>
          <a href="/pricing" className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-neutral-800">
            Get a key
          </a>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {keys.map((k) => (
            <KeyCard key={k.id} k={k} onReset={() => resetHwid(k.id)} resetting={resettingId === k.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function KeyCard({ k, onReset, resetting }: { k: KeyRow; onReset: () => void; resetting: boolean }) {
  const statusColor =
    k.status === 'active' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="break-all font-mono text-sm text-ink">{k.key_preview}</code>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>
          {k.status}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Device">{k.hwid_bound ? 'Bound' : 'Not yet bound'}</Row>
        <Row label="Uses">{k.usage_count}</Row>
        <Row label="Last used">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</Row>
        <Row label="Roblox user">{k.last_roblox_username || '—'}</Row>
        <Row label="Expires">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</Row>
      </dl>

      {k.hwid_bound && (
        <button
          onClick={onReset}
          disabled={resetting}
          className="mt-5 w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-xs font-semibold text-ink transition hover:bg-white/[0.05] disabled:opacity-50"
        >
          {resetting ? 'Resetting…' : 'Reset device'}
        </button>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="font-medium text-neutral-200">{children}</dd>
    </div>
  );
}
