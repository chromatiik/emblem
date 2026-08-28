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

export function DashboardOverview() {
  const toast = useToast();
  const confirm = useConfirm();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [claimInput, setClaimInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

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
      setClaimOpen(false);
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
    <>
      {/* Stat readouts + claim toggle sit in one row instead of a stat
          block beside a form always taking up space - the claim form is
          a rare action, not something that needs permanent screen real
          estate next to the keys someone already has. */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {keys !== null && keys.length > 0 && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-4">
              <span className="font-mono text-2xl font-bold tabular-nums text-signal">{activeCount}</span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">Active</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-4">
              <span className="font-mono text-2xl font-bold tabular-nums text-ink">{keys.length}</span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">Total</span>
            </div>
          </>
        )}
        <button
          onClick={() => setClaimOpen((v) => !v)}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
            claimOpen ? 'border-signal/40 bg-signal/10 text-signal' : 'border-white/10 text-neutral-300 hover:bg-white/[0.04]'
          }`}
        >
          {claimOpen ? 'Cancel' : 'Have a key already?'}
        </button>
      </div>

      {claimOpen && (
        <form onSubmit={claimKey} className="mt-4 rounded-2xl border border-signal/20 bg-signal/[0.03] p-5">
          <div className="flex gap-2">
            <input
              value={claimInput}
              onChange={(e) => setClaimInput(e.target.value)}
              placeholder="EMBLEM-XXXX-XXXX-XXXX-XXXX"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-ink outline-none focus:border-signal/40"
            />
            <button
              type="submit"
              disabled={claiming}
              className="shrink-0 rounded-lg bg-signal px-4 py-2 text-xs font-bold text-paper transition hover:bg-signal/90 disabled:opacity-50"
            >
              {claiming ? 'Claiming…' : 'Claim'}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Binds it to this account permanently. A key already claimed by someone else can&apos;t be reclaimed.
          </p>
        </form>
      )}

      {/* Keys as spec-sheet rows rather than a card grid - key + status at
          a glance on the left, the same detail fields as before but laid
          out inline as compact mono readouts instead of a 2-column grid
          of boxes, which is what actually differs from before, not just
          the colors on the same layout. */}
      {keys === null ? (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-neutral-400">No keys yet.</p>
          <a href="/pricing" className="mt-4 inline-block rounded-xl bg-signal px-5 py-2.5 text-sm font-bold text-paper hover:bg-signal/90">
            Get a key
          </a>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          {keys.map((k, i) => (
            <KeyRowItem key={k.id} k={k} first={i === 0} onReset={() => resetHwid(k.id)} resetting={resettingId === k.id} />
          ))}
        </div>
      )}
    </>
  );
}

function KeyRowItem({ k, first, onReset, resetting }: { k: KeyRow; first: boolean; onReset: () => void; resetting: boolean }) {
  const isActive = k.status === 'active';

  return (
    <div className={`bg-white/[0.02] p-5 ${!first ? 'border-t border-white/[0.08]' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-signal' : 'bg-red-400'}`} />
          {k.key ? (
            <div className="flex min-w-0 items-center gap-2">
              <code className="truncate font-mono text-sm text-ink">{k.key}</code>
              <CopyButton text={k.key} />
            </div>
          ) : (
            <code className="truncate font-mono text-sm text-neutral-400" title="This key was generated before full-key display was added — contact support if you need it re-sent.">
              {k.key_preview}
            </code>
          )}
        </div>
        {k.hwid_bound && (
          <button
            onClick={onReset}
            disabled={resetting}
            className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:border-signal/30 hover:bg-white/[0.04] disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset device'}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-xs text-neutral-500">
        <span>
          <span className="text-neutral-600">device</span> <span className="text-neutral-300">{k.hwid_bound ? 'bound' : 'unbound'}</span>
        </span>
        <span>
          <span className="text-neutral-600">uses</span> <span className="text-neutral-300">{k.usage_count}</span>
        </span>
        <span>
          <span className="text-neutral-600">last used</span>{' '}
          <span className="text-neutral-300">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'never'}</span>
        </span>
        <span>
          <span className="text-neutral-600">roblox</span> <span className="text-neutral-300">{k.last_roblox_username || '—'}</span>
        </span>
        <span>
          <span className="text-neutral-600">expires</span>{' '}
          <span className="text-neutral-300">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'never'}</span>
        </span>
      </div>
    </div>
  );
}
