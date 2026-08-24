import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
