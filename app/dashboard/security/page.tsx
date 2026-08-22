'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type Session = { id: string; userAgent: string; createdAt: string; isCurrent: boolean };

export default function SecurityPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadSessions() {
    const res = await fetch('/api/auth/sessions');
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function revokeOthers() {
    if (!confirm('Log out every other session? This device will stay logged in.')) return;
    await fetch('/api/auth/sessions', { method: 'DELETE' });
    toast.push('Other sessions logged out.', 'success');
    loadSessions();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirmPassword) {
      toast.push('New passwords do not match.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not update password.', 'error');
        return;
      }
      toast.push('Password updated. Other sessions were logged out.', 'success');
      setCurrent('');
      setNext('');
      setConfirmPassword('');
      loadSessions();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Security</h1>
        <p className="mt-1 text-sm text-neutral-400">Manage your password and active sessions.</p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur">
        <h2 className="font-bold text-ink">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 max-w-sm space-y-3">
          <input
            type="password"
            placeholder="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="New password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-ink">Active sessions</h2>
          <button onClick={revokeOthers} className="text-xs font-semibold text-red-400 hover:underline">
            Log out other devices
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {sessions === null ? (
            <div className="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div>
                  <div className="text-sm text-neutral-200">{s.userAgent || 'Unknown device'}</div>
                  <div className="text-xs text-neutral-400">Signed in {new Date(s.createdAt).toLocaleString()}</div>
                </div>
                {s.isCurrent && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    THIS DEVICE
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-2 focus:ring-ink/10';
