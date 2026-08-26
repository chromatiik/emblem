'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { CopyButton } from '@/components/CopyButton';
import { useConfirm } from '@/components/ConfirmDialog';

type KeyRow = {
  id: string;
  key_preview: string;
  key: string | null;
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
  const confirm = useConfirm();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [claimInput, setClaimInput] = useState('');
  const [claiming, setClaiming] = useState(false);

  async function load() {
    const res = await fetch('/api/keys');
    const data = await res.json();
    setKeys(data.keys ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function claimKey(e: React.FormEvent) {
    e.preventDefault();
    if (!claimInput.trim()) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/keys/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: claimInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not claim key.', 'error');
        return;
      }
      toast.push('Key claimed and bound to your account.', 'success');
      setClaimInput('');
      load();
    } finally {
      setClaiming(false);
    }
  }

  async function resetHwid(id: string) {
    if (!(await confirm('Reset the device bound to this key? You can only do this once a week per key.', { confirmLabel: 'Reset device' }))) return;
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

  const activeCount = keys?.filter((k) => k.status === 'active').length ?? 0;

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Account</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Your keys</h1>
      <p className="mt-1 text-sm text-neutral-400">Everything tied to your account.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {keys !== null && keys.length > 0 && (
          <div className="flex divide-x divide-white/[0.08] rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex-1 px-6 py-4">
              <div className="text-2xl font-bold text-ink">{activeCount}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Active</div>
            </div>
            <div className="flex-1 px-6 py-4">
              <div className="text-2xl font-bold text-ink">{keys.length}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Total keys</div>
            </div>
          </div>
        )}

        <form onSubmit={claimKey} className={`rounded-2xl border border-white/10 bg-white/[0.02] p-4 ${keys && keys.length > 0 ? '' : 'sm:col-span-2'}`}>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Have a key already?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={claimInput}
              onChange={(e) => setClaimInput(e.target.value)}
              placeholder="EMBLEM-XXXX-XXXX-XXXX-XXXX"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-ink outline-none focus:border-white/25"
            />
            <button
              type="submit"
              disabled={claiming}
              className="shrink-0 rounded-lg bg-ink px-4 py-2 text-xs font-bold text-paper transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {claiming ? 'Claiming…' : 'Claim'}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Binds it to this account permanently. A key already claimed by someone else can&apos;t be reclaimed.
          </p>
        </form>
      </div>

      {keys === null ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-neutral-400">No keys yet.</p>
          <a href="/pricing" className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-neutral-200">
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
        <div className="min-w-0 flex-1">
          {k.key ? (
            <div className="flex items-center gap-2">
              <code className="break-all font-mono text-sm text-ink">{k.key}</code>
              <CopyButton text={k.key} />
            </div>
          ) : (
            <code className="break-all font-mono text-sm text-neutral-400" title="This key was generated before full-key display was added — contact support if you need it re-sent.">
              {k.key_preview}
            </code>
          )}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>
          {k.status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4 text-sm">
        <Row label="Device">{k.hwid_bound ? 'Bound' : 'Not yet bound'}</Row>
        <Row label="Uses">{k.usage_count}</Row>
        <Row label="Last used">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</Row>
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
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-neutral-500">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-neutral-200">{children}</dd>
    </div>
  );
}
