'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { CopyButton } from '@/components/CopyButton';

type KeyRow = {
  id: string;
  key_preview: string;
  key: string | null;
  status: string;
  hwid_bound: boolean;
  usage_count: number;
  last_used_at: string | null;
  owner_username: string | null;
  owner_email: string | null;
  expires_at: string | null;
  created_at: string;
};

export default function AdminKeysPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('');
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/keys');
    const data = await res.json();
    setKeys(data.keys ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: email || undefined,
          durationDays: days ? parseInt(days, 10) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not generate key.', 'error');
        return;
      }
      setNewKey(data.plaintextKey);
      setEmail('');
      setDays('');
      load();
    } finally {
      setGenerating(false);
    }
  }

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/admin/keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.push(data.error || 'Action failed.', 'error');
      return;
    }
    toast.push('Updated.', 'success');
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Keys</h1>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur">
        <h2 className="font-bold text-ink">Generate a key</h2>
        <form onSubmit={generate} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-neutral-400">
            Owner email (optional)
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="buyer@example.com"
              className="mt-1 block w-56 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-ink/30"
            />
          </label>
          <label className="text-xs font-semibold text-neutral-400">
            Duration in days (blank = lifetime)
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              inputMode="numeric"
              placeholder="30"
              className="mt-1 block w-40 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-ink/30"
            />
          </label>
          <button
            type="submit"
            disabled={generating}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </form>

        {newKey && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-3">
            <div>
              <div className="text-xs font-semibold text-emerald-400">New key — shown once, copy it now:</div>
              <code className="font-mono text-sm text-ink">{newKey}</code>
            </div>
            <CopyButton text={newKey} />
          </div>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Uses</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys?.map((k) => (
              <tr key={k.id} className="border-t border-white/[0.06]">
                <td className="px-4 py-3">
                  {k.key ? (
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-xs text-ink">{k.key}</code>
                      <CopyButton text={k.key} />
                    </div>
                  ) : (
                    <code className="font-mono text-xs text-neutral-400">{k.key_preview}</code>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-400">{k.owner_username || '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={k.status} />
                </td>
                <td className="px-4 py-3 text-neutral-400">{k.hwid_bound ? 'Bound' : '—'}</td>
                <td className="px-4 py-3 text-neutral-400">{k.usage_count}</td>
                <td className="px-4 py-3 text-neutral-400">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {k.status !== 'revoked' && <ActionBtn onClick={() => act(k.id, 'revoke')}>Revoke</ActionBtn>}
                    {k.status !== 'banned' && (
                      <ActionBtn danger onClick={() => act(k.id, 'ban')}>Ban</ActionBtn>
                    )}
                    {k.status !== 'active' && <ActionBtn onClick={() => act(k.id, 'reactivate')}>Reactivate</ActionBtn>}
                    {k.hwid_bound && <ActionBtn onClick={() => act(k.id, 'hwid_reset')}>Reset HWID</ActionBtn>}
                    <ActionBtn onClick={() => act(k.id, 'extend', { extendDays: 30 })}>+30d</ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    revoked: 'text-neutral-400 border-white/10 bg-white/[0.04]',
    banned: 'text-red-400 border-red-500/30 bg-red-500/10',
    expired: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${colors[status] || colors.revoked}`}>{status}</span>
  );
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
        danger ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
      }`}
    >
      {children}
    </button>
  );
}
