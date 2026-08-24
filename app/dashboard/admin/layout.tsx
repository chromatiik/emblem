import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminSidebarLink } from '@/components/AdminSidebarLink';

const LINK_GROUPS: { label: string; links: { href: string; label: string; exact?: boolean }[] }[] = [
  {
    label: 'General',
    links: [{ href: '/dashboard/admin', label: 'Overview', exact: true }],
  },
  {
    label: 'Customers',
    links: [
      { href: '/dashboard/admin/users', label: 'Users' },
      { href: '/dashboard/admin/visitors', label: 'Visitors' },
      { href: '/dashboard/admin/keys', label: 'Keys' },
      { href: '/dashboard/admin/plans', label: 'Plans' },
    ],
  },
  {
    label: 'Product',
    links: [
      { href: '/dashboard/admin/scripts', label: 'Scripts' },
      { href: '/dashboard/admin/analytics', label: 'Analytics' },
      { href: '/dashboard/admin/audit-logs', label: 'Audit logs' },
    ],
  },
  {
    label: 'System',
    links: [
      { href: '/dashboard/admin/settings', label: 'Settings' },
      { href: '/dashboard/admin/security', label: 'Admin 2FA' },
    ],
  },
];

export default async function DashboardAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/admin');
  if (user.role !== 'admin' && user.role !== 'owner') redirect('/dashboard');

  return (
    <div className="lg:flex lg:items-start lg:gap-10">
      <aside className="mb-8 shrink-0 lg:sticky lg:top-24 lg:mb-0 lg:w-48">
        <div className="mb-5 flex items-center gap-2">
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-neutral-400">
            Admin
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:block lg:space-y-5 lg:overflow-visible lg:pb-0">
          {LINK_GROUPS.map((group) => (
            <div key={group.label} className="shrink-0 lg:shrink lg:space-y-0.5">
              <p className="hidden px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600 lg:block">
                {group.label}
              </p>
              <div className="flex gap-1 lg:mt-1.5 lg:flex-col lg:gap-0.5">
                {group.links.map((link) => (
                  <AdminSidebarLink key={link.href} href={link.href} exact={link.exact}>
                    {link.label}
                  </AdminSidebarLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 border-t border-white/10 pt-6 lg:border-t-0 lg:pt-0">{children}</div>
    </div>
  );
}
