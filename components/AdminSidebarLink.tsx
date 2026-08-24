'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminSidebarLink({
  href,
  exact,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
        isActive ? 'bg-white/[0.08] text-ink' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}
