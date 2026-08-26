import Link from 'next/link';
import { SiteBackground } from '@/components/SiteBackground';
import { SiteNav } from '@/components/SiteNav';

export const metadata = { title: 'Terms of Service — Emblem' };

export default function TermsPage() {
  return (
    <>
      <SiteBackground />
      <SiteNav />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-black text-ink">Terms of Service</h1>
        <p className="mt-2 text-sm text-neutral-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-neutral-300">
          <Section title="1. Acceptance of these terms">
            <p>
              By creating an account, purchasing a key, or otherwise using Emblem (&quot;the Service&quot;), you agree to
              be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </Section>

          <Section title="2. What Emblem is">
            <p>
              Emblem is a Roblox Lua script, delivered through an authenticated key-based system. It is a single
              product, not a platform hosting scripts from multiple sellers. We are not a Roblox executor, and we
              are not affiliated with, endorsed by, or sponsored by Roblox Corporation.
            </p>
          </Section>

          <Section title="3. Your responsibility — Roblox&apos;s own Terms">
            <p>
              Using third-party scripts or executors with Roblox is a violation of{' '}
              <a href="https://en.help.roblox.com/hc/en-us/articles/115004647846" target="_blank" rel="noopener noreferrer" className="text-ink underline">
                Roblox&apos;s Terms of Service
              </a>{' '}
              and can result in account warnings, suspensions, or permanent bans at Roblox&apos;s sole discretion. This
              risk exists independently of anything we do and is entirely outside our control. By using the Service,
              you acknowledge and accept this risk. We strongly recommend never using scripts on an account you are
              not prepared to lose.
            </p>
          </Section>

          <Section title="4. Accounts">
            <p>
              You&apos;re responsible for maintaining the security of your account and password. You&apos;re
              responsible for all activity that happens under your account. Notify us immediately if you suspect
              unauthorized access.
            </p>
          </Section>

          <Section title="5. Keys, HWID binding, and access">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Keys are personal to your account and are not transferable, resellable, or shareable.</li>
              <li>A key binds to one device (HWID) on first use. You can reset this from your dashboard, subject to a cooldown period intended to prevent abuse.</li>
              <li>We may revoke, suspend, or ban a key at our discretion for suspected abuse, fraud, chargebacks, or violation of these Terms.</li>
              <li>Keys expire according to the plan purchased. Expired keys are not automatically renewed or refunded.</li>
            </ul>
          </Section>

          <Section title="6. Payments and refunds">
            <p>We accept payment via card (processed by Stripe), cryptocurrency, and manually via PayPal through a Discord support ticket.</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>All purchases are for digital goods delivered immediately upon payment confirmation. Because of this, all sales are final and non-refundable once a key has been issued, except where required by law.</li>
              <li>Cryptocurrency payments are non-reversible by their nature. Send only the exact currency and network specified — funds sent on the wrong network or in the wrong amount cannot be recovered by us.</li>
              <li>Chargebacks or payment disputes filed without first contacting us for support will result in immediate revocation of the associated key(s) and may result in an account ban.</li>
              <li>Prices are subject to change at any time without notice; changes do not affect purchases already made.</li>
            </ul>
          </Section>

          <Section title="7. Acceptable use">
            <p>You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Share, resell, sublicense, or distribute your key or any script obtained through the Service.</li>
              <li>Attempt to reverse engineer, decompile, or bypass the Service&apos;s authentication or protection mechanisms.</li>
              <li>Use the Service to violate any applicable law, or to harass, harm, or defraud any other person.</li>
              <li>Use automated means (bots, scripts) to interact with the Service outside of the documented loader flow.</li>
            </ul>
          </Section>

          <Section title="8. Service availability">
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranty of any kind. We
              don&apos;t guarantee uninterrupted or error-free operation, and we don&apos;t guarantee that any given
              script will remain undetected by or compatible with Roblox&apos;s anti-cheat systems, which change without
              notice.
            </p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>
              To the fullest extent permitted by law, Emblem and its operators are not liable for any indirect,
              incidental, special, or consequential damages arising from your use of the Service, including but not
              limited to Roblox account actions taken against you, lost data, or lost profits. Our total liability
              for any claim arising from these Terms or the Service is limited to the amount you paid us in the 90
              days preceding the claim.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We may suspend or terminate your account and access to the Service at any time, with or without notice,
              for violation of these Terms or for any other reason at our discretion. You may stop using the Service
              at any time.
            </p>
          </Section>

          <Section title="11. Changes to these terms">
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes take effect
              constitutes acceptance of the revised Terms. Material changes will be reflected by updating the
              &quot;Last updated&quot; date above.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Questions about these Terms? Reach us through{' '}
              <Link href="/discord" className="text-ink underline">
                our Discord server
              </Link>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-5 text-sm text-amber-200/80">
          <strong className="text-amber-200">Not legal advice.</strong> This is a general-purpose template covering
          the standard points for a service like this one, not a substitute for review by a lawyer familiar with your
          jurisdiction and business specifics — worth having reviewed before you rely on it, especially the refund,
          liability, and governing-law sections.
        </div>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
