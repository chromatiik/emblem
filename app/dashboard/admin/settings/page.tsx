'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Dropdown } from '@/components/Dropdown';

type ConfigRow = { key: string; value: string; updated_at: string };

export default function SettingsPage() {
  const toast = useToast();
  const [config, setConfig] = useState<ConfigRow[] | null>(null);
  const [discordUrl, setDiscordUrl] = useState('');
  const [scriptStatus, setScriptStatus] = useState('online');
  const [currentVersion, setCurrentVersion] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/config');
    const data = await res.json();
    const rows: ConfigRow[] = data.config ?? [];
    setConfig(rows);
    setDiscordUrl(rows.find((r) => r.key === 'discord_invite_url')?.value ?? '');
    setScriptStatus(rows.find((r) => r.key === 'script_status')?.value ?? 'online');
    setCurrentVersion(rows.find((r) => r.key === 'current_version')?.value ?? '');
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string, value: string) {
    setSaving(key);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not save.', 'error');
        return;
      }
      toast.push('Saved.', 'success');
      load();
    } finally {
      setSaving(null);
    }
  }

  if (config === null) {
    return <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />;
  }

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Site-wide configuration. Changes take effect immediately — the landing page and <code>/discord</code> read these
        fresh from the database on every request, no caching involved.
      </p>

      <div className="mt-6 max-w-lg space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="font-bold text-ink">Discord invite</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Where <code>/discord</code> on your site redirects to.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.gg/your-invite"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
            />
            <button
              onClick={() => save('discord_invite_url', discordUrl)}
              disabled={saving === 'discord_invite_url'}
              className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-200 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="font-bold text-ink">Script status</h2>
          <p className="mt-1 text-sm text-neutral-400">Shown on the landing page.</p>
          <div className="mt-3 flex gap-2">
            <Dropdown
              value={scriptStatus}
              onChange={setScriptStatus}
              options={[
                { value: 'online', label: 'Online' },
                { value: 'offline', label: 'Offline' },
              ]}
              className="flex-1"
            />
            <button
              onClick={() => save('script_status', scriptStatus)}
              disabled={saving === 'script_status'}
              className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-200 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="font-bold text-ink">Current version</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Shown on the landing page. Set automatically when you enable a script version from{' '}
            <a href="/dashboard/admin/scripts" className="text-ink underline">
              Scripts
            </a>
            , or override it here.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={currentVersion}
              onChange={(e) => setCurrentVersion(e.target.value)}
              placeholder="1.0.0"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
            />
            <button
              onClick={() => save('current_version', currentVersion)}
              disabled={saving === 'current_version'}
              className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-200 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
