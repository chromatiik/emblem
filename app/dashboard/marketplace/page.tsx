'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';

type MyConfig = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  download_count: number;
  created_at: string;
};

export default function DashboardMarketplacePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [mine, setMine] = useState<MyConfig[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch('/api/marketplace/mine');
    const data = await res.json();
    setMine(data.configs ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, tags, configJson }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not upload config.', 'error');
        return;
      }
      toast.push('Config uploaded.', 'success');
      setName('');
      setDescription('');
      setTagsInput('');
      setConfigJson('');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(c: MyConfig) {
    if (!(await confirm(`Delete "${c.name}"? This can't be undone.`, { confirmLabel: 'Delete', danger: true }))) return;
    const res = await fetch(`/api/marketplace/${c.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      toast.push(data.error || 'Could not delete.', 'error');
      return;
    }
    toast.push('Deleted.', 'success');
    load();
  }

  async function onDownload(c: MyConfig) {
    const res = await fetch(`/api/marketplace/${c.id}`);
    const data = await res.json();
    if (!res.ok || !data.config) {
      toast.push(data.error || 'Could not load config.', 'error');
      return;
    }
    const filename = c.name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'config';
    const blob = new Blob([data.config.config_json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Your account</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Marketplace</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Upload configs for other Emblem users to find. Browse everyone else's at{' '}
        <Link href="/marketplace" className="text-ink underline underline-offset-2">
          the public marketplace
        </Link>
        .
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="font-bold text-ink">Upload a config</h2>
          <div className="mt-4 space-y-4">
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className={inputClass} />
            </Field>
            <Field label="Description" hint="What's this config good for?">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </Field>
            <Field label="Tags" hint="Comma-separated, e.g. rage, aimbot, combat">
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Config JSON" hint="Paste the exported config file's contents.">
              <textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                required
                rows={6}
                placeholder='{"flags": {...}}'
                className={`${inputClass} resize-none font-mono text-xs`}
              />
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-signal py-3 text-sm font-bold text-paper transition hover:bg-signal/90 disabled:opacity-50"
            >
              {submitting ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>

        <div>
          <h2 className="font-bold text-ink">Your uploads</h2>
          <div className="mt-4 space-y-3">
            {mine === null ? (
              <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/[0.02]" />
            ) : mine.length === 0 ? (
              <p className="text-sm text-neutral-500">Nothing uploaded yet.</p>
            ) : (
              mine.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/marketplace/${c.id}`} className="font-semibold text-ink hover:underline">
                        {c.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-neutral-500">↓{c.download_count} downloads</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => onDownload(c)}
                        className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-neutral-300 hover:bg-white/[0.05]"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => onDelete(c)}
                        className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-signal/40';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
