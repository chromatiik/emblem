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

  const cards = [
    { label: 'Total users', value: stats?.total_users },
    { label: 'Total keys', value: stats?.total_keys },
    { label: 'Active keys', value: stats?.active_keys },
    { label: 'Executions today', value: stats?.executions_today },
    { label: 'Failed auth (7d)', value: stats?.failed_auth_week },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Overview</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur">
            <div className="text-3xl font-black text-ink">{c.value ?? '0'}</div>
            <div className="mt-1 text-xs font-medium text-neutral-400">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-neutral-400">
        See <a href="/dashboard/admin/analytics" className="text-ink hover:underline">Analytics</a> for execution trends, top keys, and
        rate-limit activity, or <a href="/dashboard/admin/audit-logs" className="text-ink hover:underline">Audit logs</a> for every
        sensitive action taken by admins.
      </p>
    </div>
  );
}
