'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { usePromptText } from '@/components/ConfirmDialog';

type VisitorRow = {
  id: string;
  ip: string;
  user_id: string | null;
  last_username: string | null;
  visit_count: number;
  last_path: string | null;
  first_seen: string;
  last_seen: string;
  ip_banned: boolean;
};

export default function AdminVisitorsPage() {
  const toast = useToast();
  const promptText = usePromptText();
  const [visitors, setVisitors] = useState<VisitorRow[] | null>(null);
  const [search, setSearch] = useState('');

  async function load(q?: string) {
    const res = await fetch(`/api/admin/visitors${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const data = await res.json();
    setVisitors(data.visitors ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function banIp(row: VisitorRow) {
    const reason = await promptText(`Ban IP ${row.ip}?`, { placeholder: 'Optional reason', danger: true, confirmLabel: 'Ban IP' });
    if (reason === null) return;
    const res = await fetch('/api/admin/visitors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: row.ip, action: 'ban', reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.push(data.error || 'Could not ban IP.', 'error');
      return;
    }
    toast.push(`Banned ${row.ip}.`, 'success');
    load(search);
  }

  async function unbanIp(row: VisitorRow) {
    const res = await fetch('/api/admin/visitors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: row.ip, action: 'unban' }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.push(data.error || 'Could not unban IP.', 'error');
      return;
    }
    toast.push(`Unbanned ${row.ip}.`, 'success');
    load(search);
  }

  const bannedCount = visitors?.filter((v) => v.ip_banned).length ?? 0;

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Visitors</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Every IP that has loaded the site, whether or not it&apos;s ever been tied to an account. Banning here blocks the
        whole site, not just login.
      </p>

      {visitors !== null && visitors.length > 0 && (
        <div className="mt-6 flex divide-x divide-white/[0.08] rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex-1 px-6 py-4">
            <div className="text-2xl font-bold text-ink">{visitors.length}</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Known IPs</div>
          </div>
          <div className="flex-1 px-6 py-4">
            <div className="text-2xl font-bold text-ink">{bannedCount}</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Currently banned</div>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(search);
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by IP or username..."
          className="w-full max-w-xs rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-ink outline-none focus:border-ink/30"
        />
        <button type="submit" className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/[0.05]">
          Search
        </button>
      </form>

      <p className="mt-6 text-xs text-neutral-500 sm:hidden">Swipe left/right to see more columns →</p>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10 sm:mt-6">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">IP</th>
              <th className="whitespace-nowrap px-4 py-3">Account</th>
              <th className="whitespace-nowrap px-4 py-3">Visits</th>
              <th className="whitespace-nowrap px-4 py-3">First seen</th>
              <th className="whitespace-nowrap px-4 py-3">Last seen</th>
              <th className="whitespace-nowrap px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visitors?.map((v) => (
              <tr key={v.id} className="border-t border-white/[0.06]">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-xs text-ink">{v.ip}</code>
                    {v.ip_banned && (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">
                        Banned
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
                  {v.last_username || <span className="text-neutral-600">No account</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-400">{v.visit_count}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-400">{new Date(v.first_seen).toLocaleDateString()}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-400">{new Date(v.last_seen).toLocaleString()}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {v.ip_banned ? (
                    <ActionBtn onClick={() => unbanIp(v)}>Unban IP</ActionBtn>
                  ) : (
                    <ActionBtn danger onClick={() => banIp(v)}>Ban IP</ActionBtn>
                  )}
                </td>
              </tr>
            ))}
            {visitors !== null && visitors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No visitors logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
        danger ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
      }`}
    >
      {children}
    </button>
  );
}
