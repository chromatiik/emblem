import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NavLinks } from '@/components/NavLinks';

export default async function DashboardAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/admin');
  if (user.role !== 'admin' && user.role !== 'owner') redirect('/dashboard');

  const links = [
    { href: '/dashboard/admin', label: 'Overview' },
    { href: '/dashboard/admin/users', label: 'Users' },
    { href: '/dashboard/admin/keys', label: 'Keys' },
    { href: '/dashboard/admin/plans', label: 'Plans' },
    { href: '/dashboard/admin/scripts', label: 'Scripts' },
    { href: '/dashboard/admin/analytics', label: 'Analytics' },
    { href: '/dashboard/admin/audit-logs', label: 'Audit logs' },
    { href: '/dashboard/admin/settings', label: 'Settings' },
    { href: '/dashboard/admin/security', label: 'Admin 2FA' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-white/10 pb-4">
        <span className="mr-2 rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
          Admin
        </span>
        <NavLinks items={links} exactPaths={['/dashboard/admin']} size="sm" />
      </div>
      {children}
    </div>
  );
}
