'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type Version = {
  id: string;
  version: string;
  release_notes: string;
  is_enabled: boolean;
  supported_executors: string[];
  created_by_username: string | null;
  payload_length: number;
  created_at: string;
};

export default function AdminScriptsPage() {
  const toast = useToast();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [executors, setExecutors] = useState('');
  const [payload, setPayload] = useState('');
  const [enableNow, setEnableNow] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/scripts');
    const data = await res.json();
    setVersions(data.versions ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    try {
      const res = await fetch('/api/admin/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version,
          releaseNotes: notes,
          payload,
          supportedExecutors: executors.split(',').map((s) => s.trim()).filter(Boolean),
          enableImmediately: enableNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Upload failed.', 'error');
        return;
      }
      toast.push('Version uploaded.', 'success');
      setVersion('');
      setNotes('');
      setExecutors('');
      setPayload('');
      load();
    } finally {
      setUploading(false);
    }
  }

  async function act(id: string, action: 'enable' | 'disable' | 'delete') {
    if (action === 'delete' && !confirm('Delete this version permanently?')) return;
    const res = await fetch(`/api/admin/scripts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.push(data.error || 'Action failed.', 'error');
      return;
    }
    toast.push('Updated.', 'success');
    load();
  }

  async function emergencyRevoke() {
    if (!confirm('Immediately invalidate every in-progress loader session? Use this if you suspect active abuse.')) return;
    await fetch('/api/admin/emergency-revoke', { method: 'POST' });
    toast.push('All in-progress sessions revoked.', 'success');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Script versions</h1>
        <button
          onClick={emergencyRevoke}
          className="rounded-lg border border-red-500/30 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10"
        >
          Emergency: revoke in-progress sessions
        </button>
      </div>

      <form onSubmit={upload} className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur">
        <h2 className="font-bold text-ink">Upload new version</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Version (e.g. 1.2.0)"
            required
            className={inputClass}
          />
          <input
            value={executors}
            onChange={(e) => setExecutors(e.target.value)}
            placeholder="Executors, comma separated"
            className={inputClass}
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Release notes"
          rows={2}
          className={inputClass}
        />
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder="Lua payload — this is private and never rendered publicly"
          rows={8}
          required
          className={`${inputClass} font-mono text-xs`}
        />
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={enableNow} onChange={(e) => setEnableNow(e.target.checked)} />
          Make this the active version immediately
        </label>
        <button
          type="submit"
          disabled={uploading}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {versions?.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">v{v.version}</span>
                {v.is_enabled && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-neutral-400">
                {v.payload_length.toLocaleString()} chars · uploaded by {v.created_by_username || 'unknown'} ·{' '}
                {new Date(v.created_at).toLocaleString()}
              </div>
              {v.release_notes && <p className="mt-1 text-sm text-neutral-400">{v.release_notes}</p>}
            </div>
            <div className="flex gap-1.5">
              {!v.is_enabled && <ActionBtn onClick={() => act(v.id, 'enable')}>Enable (rollback to this)</ActionBtn>}
              {v.is_enabled && <ActionBtn onClick={() => act(v.id, 'disable')}>Disable</ActionBtn>}
              {!v.is_enabled && (
                <ActionBtn danger onClick={() => act(v.id, 'delete')}>
                  Delete
                </ActionBtn>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30';

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition ${
        danger ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
      }`}
    >
      {children}
    </button>
  );
}
