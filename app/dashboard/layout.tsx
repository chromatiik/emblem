import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { SiteBackground } from '@/components/SiteBackground';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { Logo } from '@/components/Logo';
import { NavLinks } from '@/components/NavLinks';
import { LogoutButton } from '@/components/LogoutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');

  const items = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/marketplace', label: 'Marketplace' },
    { href: '/dashboard/security', label: 'Security' },
    ...((user.role === 'admin' || user.role === 'owner') ? [{ href: '/dashboard/admin', label: 'Admin' }] : []),
  ];

  return (
    <ToastProvider>
      <ConfirmProvider>
        <SiteBackground />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-10">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-y-3 border-b border-white/[0.08] pb-6">
            <Link href="/" className="flex items-center gap-2.5 font-extrabold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal/25 bg-signal/10">
                <Logo size={20} />
              </span>
              emblem
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
                <NavLinks items={items} exactPaths={['/dashboard']} size="sm" />
              </div>
              <LogoutButton />
            </div>
          </div>
          {children}
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
