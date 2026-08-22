'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SiteBackground } from '@/components/SiteBackground';
import { Logo } from '@/components/Logo';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, totpCode: totpCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'totp_required') {
          setNeedsTotp(true);
          setError('Enter your authenticator code.');
        } else {
          setError(data.error || 'Something went wrong.');
        }
        return;
      }
      router.push(params.get('next') || '/dashboard');
      router.refresh();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <Link href="/" className="mb-8 flex items-center gap-2 font-extrabold text-ink">
          <Logo size={28} />
          emblem
        </Link>

        <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-neutral-400">Log in to manage your keys.</p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </Field>
          {needsTotp && (
            <Field label="Authenticator code">
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                className={inputClass}
              />
            </Field>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-ink py-3 text-sm font-bold text-paper transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-ink hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-2 focus:ring-ink/10';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
