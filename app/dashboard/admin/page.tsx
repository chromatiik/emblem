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

  const activeRatio = stats && Number(stats.total_keys) > 0 ? Number(stats.active_keys) / Number(stats.total_keys) : 0;

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Admin</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">Overview</h1>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        {/* Primary metric now carries a visual (ratio ring) instead of
            being a plain number in a box - the same instinct as the
            homepage's telemetry graph: a number alone doesn't read as a
            dashboard, a number with a real visual does. */}
        <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <RatioRing value={activeRatio} />
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-signal">Active keys</div>
            <div className="mt-1 font-mono text-4xl font-black tracking-tight text-ink">{stats?.active_keys ?? '0'}</div>
            <div className="mt-1 text-sm text-neutral-500">of {stats?.total_keys ?? '0'} issued total</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {secondaryCards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="font-mono text-2xl font-bold tabular-nums text-ink">{c.value ?? '0'}</div>
              <div className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="mb-3 mt-10 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-signal">Jump to</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-signal/25 hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{l.label}</span>
              <span className="text-neutral-500 transition group-hover:translate-x-0.5 group-hover:text-signal" aria-hidden>→</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RatioRing({ value }: { value: number }) {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 1));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#D4A24C"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}
