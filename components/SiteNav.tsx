import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { MobileNavMenu } from './MobileNavMenu';
import { Logo } from '@/components/Logo';
import { NavLinks } from '@/components/NavLinks';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/marketplace', label: 'Marketplace' },
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

        <div className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1 md:flex">
          <NavLinks items={items} exactPaths={['/']} size="sm" />
        </div>

        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            href="/discord"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-semibold text-ink backdrop-blur transition hover:bg-white/[0.08]"
          >
            <DiscordGlyph />
            Discord
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-neutral-200"
            >
              {user.username}
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-neutral-200"
            >
              Log in
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>

        <MobileNavMenu items={items} username={user?.username ?? null} />
      </div>
    </nav>
  );
}

function DiscordGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.04.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.834 19.834 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.278c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.947 2.419-2.157 2.419Z" />
    </svg>
  );
}
