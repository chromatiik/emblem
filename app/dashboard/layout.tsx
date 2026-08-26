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
          <div className="mb-8 flex flex-wrap items-center justify-between gap-y-3">
            <Link href="/" className="flex items-center gap-2 font-extrabold text-ink">
              <Logo size={28} />
              emblem
            </Link>
            <div className="flex flex-wrap items-center gap-1">
              <NavLinks items={items} exactPaths={['/dashboard']} />
              <LogoutButton />
            </div>
          </div>
          {children}
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
