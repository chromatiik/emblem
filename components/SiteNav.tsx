import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { MobileNavMenu } from './MobileNavMenu';
import { Logo } from '@/components/Logo';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/discord', label: 'Discord' },
];

export async function SiteNav() {
  const user = await getCurrentUser();
  const items = user ? [...NAV_ITEMS, { href: '/dashboard', label: 'Dashboard' }] : NAV_ITEMS;

  return (
    <nav className="sticky top-0 z-50">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-ink">
          <Logo size={28} />
          emblem
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-semibold text-ink backdrop-blur transition hover:bg-white/[0.08]"
            >
              {user.username}
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-neutral-300 transition hover:text-ink">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-neutral-800"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <MobileNavMenu items={items} username={user?.username ?? null} />
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-neutral-300 transition hover:text-ink">
      {children}
    </Link>
  );
}
