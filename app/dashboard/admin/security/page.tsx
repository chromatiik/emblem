'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

export default function AdminSecurityPage() {
  const toast = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Could not start setup.', 'error');
        return;
      }
      setQrCode(data.qrCodeDataUrl);
      setSecret(data.secret);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Invalid code.', 'error');
        return;
      }
      toast.push('Two-factor authentication enabled.', 'success');
      setQrCode(null);
      setSecret(null);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!confirm('Disable two-factor authentication?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push(data.error || 'Incorrect password.', 'error');
        return;
      }
      toast.push('Two-factor authentication disabled.', 'success');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Admin security</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Two-factor authentication is required for admin/owner logins once enabled.
      </p>

      <div className="mt-6 max-w-md rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur">
        {!qrCode ? (
          <>
            <h2 className="font-bold text-ink">Enable 2FA</h2>
            <p className="mt-1 text-sm text-neutral-400">Scan a QR code with your authenticator app to get started.</p>
            <button
              onClick={startSetup}
              disabled={busy}
              className="mt-4 rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-neutral-800 disabled:opacity-50"
            >
              Start setup
            </button>
          </>
        ) : (
          <>
            <h2 className="font-bold text-ink">Scan this code</h2>
            <img src={qrCode} alt="2FA QR code" className="mt-4 rounded-lg border border-white/10" width={200} height={200} />
            <p className="mt-3 break-all font-mono text-xs text-neutral-400">Manual entry key: {secret}</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter the 6-digit code"
              inputMode="numeric"
              maxLength={6}
              className="mt-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
            />
            <button
              onClick={confirmEnable}
              disabled={busy || code.length !== 6}
              className="mt-3 rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-neutral-800 disabled:opacity-50"
            >
              Confirm & enable
            </button>
          </>
        )}
      </div>

      <div className="mt-6 max-w-md rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur">
        <h2 className="font-bold text-ink">Disable 2FA</h2>
        <p className="mt-1 text-sm text-neutral-400">Requires your password to confirm.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Current password"
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
        />
        <button
          onClick={disable}
          disabled={busy || !password}
          className="mt-3 rounded-lg border border-red-500/30 px-5 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          Disable 2FA
        </button>
      </div>
    </div>
  );
}
