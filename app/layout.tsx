import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { isIpBanned, logVisit } from '@/lib/ipban';
import { getIpFromHeaders } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

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
  const headersList = headers();
  const ip = getIpFromHeaders(headersList);
  const [banned, user] = await Promise.all([
    isIpBanned(ip).catch(() => false),
    getCurrentUser().catch(() => null),
  ]);

  if (banned) {
    return (
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
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

  logVisit({
    ip,
    userId: user?.id ?? null,
    username: user?.username ?? null,
    path: headersList.get('referer') ?? '',
    userAgent: headersList.get('user-agent') ?? '',
  }).catch(() => {});

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
