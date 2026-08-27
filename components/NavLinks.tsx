'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

/**
 * `exact` items only glow when the pathname matches exactly (e.g. the
 * dashboard "Overview" link at /dashboard shouldn't glow while viewing
 * /dashboard/security). Everything else glows on a prefix match so a
 * section stays highlighted while browsing its sub-pages.
 */
export function NavLinks({ items, exactPaths = [], size = 'md' }: { items: NavItem[]; exactPaths?: string[]; size?: 'sm' | 'md' }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const isActive = exactPaths.includes(item.href) ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full font-medium transition ${
              size === 'sm' ? 'px-3.5 py-1.5 text-sm' : 'px-3.5 py-2 text-sm'
            } ${
              isActive
                ? 'bg-signal/15 text-signal'
                : 'text-neutral-400 hover:bg-white/[0.04] hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
