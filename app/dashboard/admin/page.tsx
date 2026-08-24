import Link from 'next/link';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const stats = await queryOne<{
    total_users: string;
    total_keys: string;
    active_keys: string;
    executions_today: string;
    failed_auth_week: string;
  }>(`SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM keys) AS total_keys,
      (SELECT COUNT(*) FROM keys WHERE status = 'active') AS active_keys,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'payload_fetch' AND created_at > date_trunc('day', now())) AS executions_today,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'auth_fail' AND created_at > now() - interval '7 days') AS failed_auth_week
  `);

  const secondaryCards = [
    { label: 'Total users', value: stats?.total_users },
    { label: 'Total keys', value: stats?.total_keys },
    { label: 'Executions today', value: stats?.executions_today },
    { label: 'Failed auth (7d)', value: stats?.failed_auth_week },
  ];

  const quickLinks = [
    { href: '/dashboard/admin/analytics', label: 'Analytics', desc: 'Execution trends, top keys, rate-limit activity' },
    { href: '/dashboard/admin/audit-logs', label: 'Audit logs', desc: 'Every sensitive action taken by admins' },
    { href: '/dashboard/admin/keys', label: 'Keys', desc: 'Issue, revoke, or reset device binding' },
  ];

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Overview</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Active keys</div>
          <div className="mt-2 text-5xl font-black tracking-tight text-ink">{stats?.active_keys ?? '0'}</div>
          <div className="mt-1 text-sm text-neutral-500">of {stats?.total_keys ?? '0'} issued total</div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {secondaryCards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="text-2xl font-bold text-ink">{c.value ?? '0'}</div>
              <div className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="mb-3 mt-10 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-600">Jump to</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{l.label}</span>
              <span className="text-neutral-500 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden>→</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
