import Link from 'next/link';
import { SiteBackground } from '@/components/SiteBackground';
import { SiteNav } from '@/components/SiteNav';
import { CopyButton } from '@/components/CopyButton';
import { HeroImage } from '@/components/HeroImage';
import { getPublicConfig } from '@/lib/config';
import { getWorkingExecutors } from '@/lib/executors';
import { query } from '@/lib/db';
import { formatPrice } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FEATURES = [
  { title: 'Real key authentication', desc: 'Every execution goes through a server-verified handshake — not a static file anyone can download.' },
  { title: 'HWID binding', desc: 'Keys bind to a device on first use. Reset it yourself from your dashboard when you need to.' },
  { title: 'Replay-protected', desc: 'Every auth request uses a single-use nonce. A captured request cannot be replayed to get a second execution.' },
  { title: 'Live status', desc: 'See exactly when the script is online, what version is current, and your own execution history.' },
];

const FAQ = [
  { q: 'How does the key system work?', a: 'You get a unique key on purchase. Set it in your executor, run the loadstring, and the server verifies your key and device before handing back the script — nothing sensitive is ever in a publicly downloadable file.' },
  { q: 'Can I use my key on a new device?', a: 'Yes — reset your HWID from your dashboard. There\u2019s a short cooldown between resets to prevent abuse.' },
  { q: 'What happens if I lose my key?', a: 'Log into your dashboard — every key tied to your account is listed there with its status and expiration.' },
  { q: 'Is my payment secure?', a: 'Payments are processed by Stripe. We never see or store your card details, and your key is only issued after Stripe confirms the payment server-side.' },
];

export default async function LandingPage() {
  const [config, executors] = await Promise.all([getPublicConfig(), getWorkingExecutors()]);
  const { rows: plans } = await query<{ id: string; name: string; price_cents: number; currency: string; duration_days: number | null }>(
    `SELECT id, name, price_cents, currency, duration_days FROM pricing_plans WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 3`
  );

  const loadstring = `loadstring(game:HttpGet("${process.env.SITE_URL || 'https://emblem.gg'}/script/loader/emblem.lua"))()`;
  const exampleSnippet = `script_key = "EMBLEM-F5ME-J68D"\n${loadstring}`;

  return (
    <>
      <SiteBackground />
      <SiteNav />

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-28 text-center">
          <div
            className="animate-fade-up opacity-0 mb-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400"
            style={{ animationDelay: '0ms' }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${config.scriptStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {config.scriptStatus === 'online' ? 'Online' : 'Offline'} · v{config.currentVersion}
          </div>

          <h1
            className="animate-fade-up opacity-0 select-none text-[clamp(3.75rem,13vw,8.5rem)] font-black leading-[0.88] tracking-tighter text-ink drop-shadow-[0_2px_24px_rgba(10,10,12,0.08)]"
            style={{ animationDelay: '80ms' }}
          >
            EMBLEM
          </h1>

          <p
            className="animate-fade-up opacity-0 mx-auto mt-5 max-w-md text-lg text-neutral-400"
            style={{ animationDelay: '160ms' }}
          >
            A script authentication platform for Roblox. Real keys, real device binding, real protection.
          </p>

          <div
            className="animate-fade-up opacity-0 mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: '240ms' }}
          >
            <Link
              href="/pricing"
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-bold text-paper shadow-[0_8px_24px_-8px_rgba(10,10,12,0.35)] transition hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-[0_12px_28px_-8px_rgba(10,10,12,0.4)]"
            >
              Get a key
            </Link>
            <Link
              href="/discord"
              className="rounded-full border border-white/10 bg-white/[0.045] px-7 py-3.5 text-sm font-bold text-ink backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
            >
              Join Discord
            </Link>
          </div>

          <p className="animate-fade-up opacity-0 mt-4 text-xs text-neutral-400" style={{ animationDelay: '300ms' }}>
            Using Emblem means you agree to the{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
              Terms of Service
            </Link>
            .
          </p>

          <div
            className="animate-fade-up opacity-0 mx-auto mt-12 flex max-w-3xl items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/60 px-6 py-5 text-left shadow-xl backdrop-blur"
            style={{ animationDelay: '380ms' }}
          >
            <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-white">
              <code>{exampleSnippet}</code>
            </pre>
            <CopyButton text={exampleSnippet} />
          </div>

          {/*
            Drop your own product screenshot at /public/hero-mockup.png (or
            change the src below) — this renders it exactly where the
            reference site places its hero mockup image, with no
            executor-specific "sUNC score" widget alongside it, since
            that's a benchmark for executors specifically and doesn't
            apply to what Emblem actually is.
          */}
          <div className="animate-fade-up opacity-0 mx-auto mt-16 max-w-3xl" style={{ animationDelay: '460ms' }}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl backdrop-blur">
              <HeroImage src="/hero-mockup.png" alt="Emblem dashboard" />
            </div>
          </div>
        </section>

        {/* Trust row */}
        <section className="animate-fade-in opacity-0 overflow-hidden border-y border-white/[0.08] bg-white/[0.025] py-8 backdrop-blur-sm" style={{ animationDelay: '450ms' }}>
          <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Currently working · sUNC 90%+</p>
          <div className="relative mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-marquee items-center gap-16">
              {[...executors, ...executors, ...executors, ...executors, ...executors, ...executors].map((e, i) => (
                <span key={i} className="whitespace-nowrap text-lg font-bold text-neutral-200">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="text-center text-3xl font-bold text-ink">Built to win</h2>
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_40px_-24px_rgba(10,10,12,0.25)] backdrop-blur-md transition hover:-translate-y-1 hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_28px_50px_-20px_rgba(10,10,12,0.32)]"
              >
                <h3 className="font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm text-neutral-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {plans.length > 0 && (
          <section className="mx-auto max-w-5xl px-6 py-24">
            <h2 className="text-center text-3xl font-bold text-ink">Pricing</h2>
            <div className="mt-14 grid gap-5 sm:grid-cols-3">
              {plans.map((p) => (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 text-center shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_40px_-24px_rgba(10,10,12,0.25)] backdrop-blur-md transition hover:-translate-y-1 hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_28px_50px_-20px_rgba(10,10,12,0.32)]">
                  <div className="font-bold text-ink">{p.name}</div>
                  <div className="mt-2 text-3xl font-black text-ink">{formatPrice(p.price_cents, p.currency)}</div>
                  <div className="mt-1 text-xs text-neutral-400">{p.duration_days ? `${p.duration_days} days` : 'Lifetime'}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/pricing" className="text-sm font-semibold text-ink underline underline-offset-4 hover:no-underline">
                View full pricing →
              </Link>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-3xl px-6 py-24">
          <h2 className="text-center text-3xl font-bold text-ink">FAQ</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_14px_28px_-20px_rgba(10,10,12,0.2)] backdrop-blur-md transition hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_32px_-16px_rgba(10,10,12,0.28)]">
                <summary className="cursor-pointer list-none font-semibold text-ink">{item.q}</summary>
                <p className="mt-3 text-sm text-neutral-400">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.08] py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-neutral-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Emblem</span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/discord" className="hover:text-ink">Discord</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
