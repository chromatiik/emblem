import { Suspense } from 'react';
import { SiteBackground } from '@/components/SiteBackground';
import { SiteNav } from '@/components/SiteNav';
import { CheckoutClient } from '@/components/CheckoutClient';

export default function CheckoutPage() {
  return (
    <>
      <SiteBackground />
      <SiteNav />
      <Suspense fallback={null}>
        <CheckoutClient />
      </Suspense>
    </>
  );
}
