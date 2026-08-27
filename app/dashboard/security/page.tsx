'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';

type Session = { id: string; userAgent: string; createdAt: string; isCurrent: boolean };

export default function SecurityPage() {
  const toast = useToast();
  const confirm = useConfirm();
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
    if (!(await confirm('Log out every other session? This device will stay logged in.', { confirmLabel: 'Log out others' }))) return;
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
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Account</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Security</h1>
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
            className="rounded-lg bg-signal px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-signal/90 disabled:opacity-50"
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
                  <div className="font-mono text-xs text-neutral-500">Signed in {new Date(s.createdAt).toLocaleString()}</div>
                </div>
                {s.isCurrent && (
                  <span className="rounded-full border border-signal/30 bg-signal/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-signal">
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
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-signal/40 focus:ring-2 focus:ring-signal/10';
