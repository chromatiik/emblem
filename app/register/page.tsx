'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SiteBackground } from '@/components/SiteBackground';
import { Logo } from '@/components/Logo';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      router.push('/dashboard');
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

        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-400">Manage keys and purchases from one place.</p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Username" hint="3-20 characters: letters, numbers, underscores.">
            <input value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              className={inputClass}
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-ink py-3 text-sm font-bold text-paper transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-400">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-ink hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-2 focus:ring-ink/10';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-300">{hint}</span>}
    </label>
  );
}
