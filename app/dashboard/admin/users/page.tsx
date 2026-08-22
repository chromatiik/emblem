'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { usePromptText } from '@/components/ConfirmDialog';

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  is_disabled: boolean;
  is_banned: boolean;
  key_count: string;
  created_at: string;
  last_ip: string;
  last_ip_at: string | null;
  ip_banned: boolean;
};

export default function AdminUsersPage() {
  const toast = useToast();
  const promptText = usePromptText();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [search, setSearch] = useState('');

  async function load(q = '') {
    const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(userId: string, action: string, reason?: string) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.push(data.error || 'Action failed.', 'error');
      return;
    }
    toast.push('Updated.', 'success');
    load(search);
  }

  async function banIp(user: UserRow) {
    const reason = await promptText(`Ban IP ${user.last_ip}?`, { placeholder: 'Optional reason', danger: true, confirmLabel: 'Ban IP' });
    if (reason === null) return; // cancelled
    act(user.id, 'ban_ip', reason || undefined);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Users</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(search);
        }}
        className="mt-4 max-w-sm"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username or email…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
        />
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Keys</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-white/[0.06]">
                <td className="px-4 py-3 font-semibold text-ink">{u.username}</td>
                <td className="px-4 py-3 text-neutral-400">{u.email}</td>
                <td className="px-4 py-3">
                  {u.last_ip ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-neutral-300">{u.last_ip}</span>
                      {u.ip_banned && (
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">
                          IP banned
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.role !== 'user' && (
                    <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                      {u.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.is_banned && <span className="text-red-400">Banned</span>}
                  {u.is_disabled && !u.is_banned && <span className="text-amber-400">Disabled</span>}
                  {!u.is_banned && !u.is_disabled && <span className="text-emerald-400">Active</span>}
                </td>
                <td className="px-4 py-3 text-neutral-400">{u.key_count}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.role === 'user' && (
                      <ActionBtn onClick={() => act(u.id, 'promote')}>Promote</ActionBtn>
                    )}
                    {u.role === 'admin' && <ActionBtn onClick={() => act(u.id, 'demote')}>Demote</ActionBtn>}
                    {u.is_disabled ? (
                      <ActionBtn onClick={() => act(u.id, 'enable')}>Enable</ActionBtn>
                    ) : (
                      <ActionBtn onClick={() => act(u.id, 'disable')}>Disable</ActionBtn>
                    )}
                    {u.is_banned ? (
                      <ActionBtn onClick={() => act(u.id, 'unban')}>Unban</ActionBtn>
                    ) : (
                      <ActionBtn danger onClick={() => act(u.id, 'ban')}>Ban</ActionBtn>
                    )}
                    {u.last_ip && (
                      u.ip_banned ? (
                        <ActionBtn onClick={() => act(u.id, 'unban_ip')}>Unban IP</ActionBtn>
                      ) : (
                        <ActionBtn danger onClick={() => banIp(u)}>Ban IP</ActionBtn>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
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
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
        danger
          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
          : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
      }`}
    >
      {children}
    </button>
  );
}
