'use client';

import { useEffect, useState } from 'react';

type LogRow = {
  id: number;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_username: string | null;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/audit-logs')
      .then((r) => r.json())
      .then((d) => setLogs(d.logs));
  }, []);

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Audit logs</h1>
      <p className="mt-1 text-sm text-neutral-400">Every sensitive action taken by an admin, most recent first.</p>

      <p className="mt-6 text-xs text-neutral-500 sm:hidden">Swipe left/right to see more columns →</p>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10 sm:mt-6">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Actor</th>
              <th className="whitespace-nowrap px-4 py-3">Action</th>
              <th className="whitespace-nowrap px-4 py-3">Target</th>
              <th className="whitespace-nowrap px-4 py-3">Details</th>
              <th className="whitespace-nowrap px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((l) => (
              <tr key={l.id} className="border-t border-white/[0.06]">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{l.actor_username || 'system'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-300">{l.action}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
                  {l.target_type ? `${l.target_type}:${l.target_id?.slice(0, 8)}` : '—'}
                </td>
                <td className="px-4 py-3 max-w-xs truncate font-mono text-xs text-neutral-400">
                  {Object.keys(l.details || {}).length > 0 ? JSON.stringify(l.details) : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-400">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
