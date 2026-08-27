import type { Metadata } from 'next';

import { headers } from 'next/headers';
import './globals.css';
import { isIpBanned, logVisit } from '@/lib/ipban';
import { getIpFromHeaders } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';





const SITE_URL = process.env.SITE_URL || 'https://getemblem.lol';
const DESCRIPTION =
  'Experience Emblem, a premium Deshood script built with secure key-based authentication and reliable access.';

export const metadata: Metadata = {
  title: 'Emblem',
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Emblem',
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Emblem',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Emblem' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Emblem',
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Runs on every page load, before anything renders — this is what
  // actually blocks a banned IP from reaching the site at all, not just
  // from logging in or running the script. Kept in the root layout rather
  // than middleware because the ban check and visit log both need a real
  // Postgres connection, which Next's Edge middleware runtime doesn't
  // support; Server Components run in the normal Node runtime, same as
  // every other DB call in this app.
  //
  // Middleware still plays a role here: it maintains a short-lived,
  // unforgeable cookie (HMAC over IP + time window, computed with no DB
  // access) confirming this IP already passed a real ban-check within the
  // last ~15 minutes. Skipping the repeat DB round-trip on every single
  // page view - the common case is one visitor loading many pages - cuts
  // DB touches for a browsing session from "once per page" down to
  // roughly "once per 15 minutes per visitor," without weakening the
  // check itself: the very first request in a window (or any request
  // after a stale/missing cookie) still runs the full query.
  const headersList = headers();
  const recentlyChecked = headersList.get('x-recent-visit-check') === '1';
  const ip = getIpFromHeaders(headersList);

  if (recentlyChecked) {
    return (
      <html lang="en" className={""}>
        <body className="bg-paper font-sans text-ink antialiased">{children}</body>
      </html>
    );
  }

  const [banned, user] = await Promise.all([
    isIpBanned(ip).catch(() => false),
    getCurrentUser().catch(() => null),
  ]);

  if (banned) {
    return (
      <html lang="en" className={""}>
        <body className="flex min-h-screen items-center justify-center bg-paper px-6 font-sans text-ink antialiased">
          <div className="max-w-sm text-center">
            <h1 className="text-2xl font-bold">Access denied</h1>
            <p className="mt-2 text-sm text-neutral-400">
              This IP address has been blocked. If you think that&apos;s a mistake, reach out through Discord.
            </p>
          </div>
        </body>
      </html>
    );
  }

  if (!user?.ip_logging_exempt) {
    logVisit({
      ip,
      userId: user?.id ?? null,
      username: user?.username ?? null,
      path: headersList.get('referer') ?? '',
      userAgent: headersList.get('user-agent') ?? '',
    }).catch(() => {});
  }

  return (
    <html lang="en" className={""}>
      <body className="bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
