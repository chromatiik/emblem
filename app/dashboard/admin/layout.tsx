import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminSidebarLink } from '@/components/AdminSidebarLink';

const LINK_GROUPS: { label: string; links: { href: string; label: string; exact?: boolean; icon: React.ReactNode }[] }[] = [
  {
    label: 'General',
    links: [{ href: '/dashboard/admin', label: 'Overview', exact: true, icon: <GridIcon /> }],
  },
  {
    label: 'Customers',
    links: [
      { href: '/dashboard/admin/users', label: 'Users', icon: <UsersIcon /> },
      { href: '/dashboard/admin/visitors', label: 'Visitors', icon: <PulseIcon /> },
      { href: '/dashboard/admin/keys', label: 'Keys', icon: <KeyIcon /> },
      { href: '/dashboard/admin/plans', label: 'Plans', icon: <TagIcon /> },
    ],
  },
  {
    label: 'Product',
    links: [
      { href: '/dashboard/admin/scripts', label: 'Scripts', icon: <CodeIcon /> },
      { href: '/dashboard/admin/analytics', label: 'Analytics', icon: <ChartIcon /> },
      { href: '/dashboard/admin/audit-logs', label: 'Audit logs', icon: <HistoryIcon /> },
    ],
  },
  {
    label: 'System',
    links: [
      { href: '/dashboard/admin/settings', label: 'Settings', icon: <GearIcon /> },
      { href: '/dashboard/admin/security', label: 'Admin 2FA', icon: <ShieldIcon /> },
    ],
  },
];

export default async function DashboardAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/admin');
  if (user.role !== 'admin' && user.role !== 'owner') redirect('/dashboard');

  return (
    // Full-bleed break-out of the parent dashboard layout's centered
    // max-w-6xl column - a real admin panel reads as its own app shell,
    // not a section squeezed into the same width as a marketing page.
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
      <div className="lg:flex lg:min-h-[calc(100vh-5rem)]">
        <aside className="shrink-0 border-b border-white/[0.08] bg-white/[0.015] lg:w-64 lg:border-b-0 lg:border-r">
          <div className="mx-auto max-w-6xl px-6 py-6 lg:mx-0 lg:max-w-none lg:px-6">
            <div className="mb-6 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-signal/15 text-signal">
                <ShieldIcon className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">Admin panel</span>
            </div>
            <nav className="flex gap-4 overflow-x-auto pb-1 lg:block lg:space-y-6 lg:overflow-visible lg:pb-0">
              {LINK_GROUPS.map((group) => (
                <div key={group.label} className="shrink-0 lg:shrink lg:space-y-0.5">
                  <p className="hidden px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600 lg:block">
                    {group.label}
                  </p>
                  <div className="flex gap-1 lg:mt-1.5 lg:flex-col lg:gap-0.5">
                    {group.links.map((link) => (
                      <AdminSidebarLink key={link.href} href={link.href} exact={link.exact} icon={link.icon}>
                        {link.label}
                      </AdminSidebarLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function GridIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function UsersIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="6" cy="5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 2.2c1.2.3 2 1.4 2 2.8s-.8 2.5-2 2.8M12.5 10.3c1.7.4 3 1.8 3 3.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function PulseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M1.5 8h3l1.5-4.5L9 12.5 10.5 8H14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function KeyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="5" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 8h7M12 8v2.5M14.5 8v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function TagIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M2 2h5.5L14 8.5 8.5 14 2 7.5V2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="1" fill="currentColor" />
    </svg>
  );
}
function CodeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M5 4 1.5 8 5 12M11 4l3.5 4L11 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChartIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M2 14V6M7 14V2M12 14V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function HistoryIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2l2.2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function GearIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 2.2v1.4M8 12.4v1.4M13.8 8h-1.4M3.6 8H2.2M11.9 4.1l-1 1M5.1 10.9l-1 1M11.9 11.9l-1-1M5.1 5.1l-1-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function ShieldIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M8 1.5 13.5 3.5V7.5C13.5 11 11.2 13.3 8 14.5C4.8 13.3 2.5 11 2.5 7.5V3.5L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.75 8 7.25 9.5 10.25 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
