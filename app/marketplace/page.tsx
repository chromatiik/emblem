import { SiteBackground } from '@/components/SiteBackground';
import { SiteNav } from '@/components/SiteNav';
import { MarketplaceClient } from '@/components/MarketplaceClient';

export const metadata = { title: 'Marketplace — Emblem' };

export default function MarketplacePage() {
  return (
    <>
      <SiteBackground />
      <SiteNav />
      <MarketplaceClient />
    </>
  );
}
