'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminSidebarLink({
  href,
  exact,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition ${
        isActive ? 'bg-signal/10 text-signal' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-ink'
      }`}
    >
      {icon && <span className={isActive ? 'text-signal' : 'text-neutral-600'}>{icon}</span>}
      {children}
    </Link>
  );
}
