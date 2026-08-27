import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { SiteBackground } from '@/components/SiteBackground';
import { SiteNav } from '@/components/SiteNav';
import { CopyButton } from '@/components/CopyButton';
import { TelemetryGraph } from '@/components/TelemetryGraph';
import { getPublicConfig } from '@/lib/config';
import { getWorkingExecutors } from '@/lib/executors';
import { query } from '@/lib/db';
import { formatPrice } from '@/lib/format';

const getHomepageData = unstable_cache(
  async () => {
    const [config, executors] = await Promise.all([getPublicConfig(), getWorkingExecutors()]);
    const { rows: plans } = await query<{ id: string; name: string; price_cents: number; currency: string; duration_days: number | null }>(
      `SELECT id, name, price_cents, currency, duration_days FROM pricing_plans WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 3`
    );
    const { rows: statRows } = await query<{ keys_issued: string; verified_runs: string; hwid_resets: string }>(
      `SELECT
        (SELECT COUNT(*) FROM keys) AS keys_issued,
        (SELECT COUNT(*) FROM script_usage WHERE event_type = 'auth_success') AS verified_runs,
        (SELECT COALESCE(SUM(hwid_reset_count), 0) FROM keys) AS hwid_resets`
    );
    return { config, executors, plans, statRow: statRows[0] ?? { keys_issued: '0', verified_runs: '0', hwid_resets: '0' } };
  },
  ['homepage-data'],
  { revalidate: 60 }
);

const SPEC = [
  { label: 'Auth', title: 'Server-verified handshake', desc: 'Every execution round-trips through the auth server first — not a static file anyone can download and reuse.', icon: LockIcon },
  { label: 'Device', title: 'HWID binding', desc: 'Keys bind to a device on first use. Reset it yourself from your dashboard when you need to.', icon: DeviceIcon },
  { label: 'Replay', title: 'Single-use nonce', desc: 'Every auth request is one-time. A captured request cannot be replayed for a second execution.', icon: ShieldIcon },
  { label: 'Status', title: 'Live version + uptime', desc: 'See exactly when the script is online, what version is current, and your own execution history.', icon: PulseIcon },
];

const FAQ = [
  { q: 'How does the key system work?', a: 'You get a unique key on purchase. Set it in your executor, run the loadstring, and the server verifies your key and device before handing back the script — nothing sensitive is ever in a publicly downloadable file.' },
  { q: 'Can I use my key on a new device?', a: 'Yes — reset your HWID from your dashboard. There\u2019s a short cooldown between resets to prevent abuse.' },
  { q: 'What happens if I lose my key?', a: 'Log into your dashboard — every key tied to your account is listed there with its status and expiration.' },
  { q: 'Is my payment secure?', a: 'Payments are processed by Stripe. We never see or store your card details, and your key is only issued after Stripe confirms the payment server-side.' },
];

export default async function LandingPage() {
  const { config, executors, plans, statRow } = await getHomepageData();
  const stats = statRow;
  const showStats = parseInt(stats.keys_issued, 10) > 0;
  const formatStat = (n: string) => {
    const num = parseInt(n, 10) || 0;
    return num >= 1000 ? `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k` : String(num);
  };

  const loadstring = `loadstring(game:HttpGet("${process.env.SITE_URL || 'https://emblem.gg'}/script/loader/emblem.lua"))()`;
  const exampleSnippet = loadstring;

  return (
    <>
      <SiteBackground />
      <SiteNav />

      <main className="relative z-10">
        {/* Hero — asymmetric: copy left, live telemetry right */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-28">
          <div className="grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-10">
            <div className="lg:col-span-7">
              <div
                className="animate-fade-up opacity-0 mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-300"
                style={{ animationDelay: '0ms' }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {config.scriptStatus === 'online' && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  )}
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.scriptStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </span>
                {config.scriptStatus === 'online' ? 'Online' : 'Offline'} · v{config.currentVersion}
              </div>

              <h1
                className="animate-fade-up opacity-0 select-none text-[clamp(3.25rem,7.5vw,5.75rem)] font-black leading-[0.9] tracking-tighter text-ink"
                style={{ animationDelay: '80ms' }}
              >
                Built to run
                <br />
                <span className="text-signal">clean.</span>
              </h1>

              <p
                className="animate-fade-up opacity-0 mt-6 max-w-md text-lg leading-relaxed text-neutral-400"
                style={{ animationDelay: '160ms' }}
              >
                Emblem is engineered the way the graph on the right measures it — verified, not advertised. Real key
                authentication, device binding, and performance work that shows up as a number, not a claim.
              </p>

              <div
                className="animate-fade-up opacity-0 mt-9 flex flex-wrap items-center gap-3"
                style={{ animationDelay: '240ms' }}
              >
                <Link
                  href="/pricing"
                  className="flex items-center gap-1.5 rounded-full bg-ink px-7 py-3.5 text-sm font-bold text-paper shadow-[0_8px_24px_-8px_rgba(10,10,12,0.35)] transition hover:-translate-y-0.5 hover:bg-neutral-200 hover:shadow-[0_12px_28px_-8px_rgba(10,10,12,0.4)]"
                >
                  Get a key
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/discord"
                  className="rounded-full border border-white/10 bg-white/[0.045] px-7 py-3.5 text-sm font-bold text-ink backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
                >
                  Join Discord
                </Link>
              </div>

              <div
                className="animate-fade-up opacity-0 mt-7 flex flex-wrap items-center gap-2"
                style={{ animationDelay: '280ms' }}
              >
                {[
                  { label: 'Instant key delivery', icon: BoltIcon },
                  { label: 'Device-bound keys', icon: LockIcon },
                  { label: 'One-time payment', icon: CardIcon },
                ].map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-neutral-300"
                  >
                    <Icon className="h-3 w-3 text-neutral-500" />
                    {label}
                  </span>
                ))}
              </div>

              <p className="animate-fade-up opacity-0 mt-4 text-xs text-neutral-400" style={{ animationDelay: '300ms' }}>
                Using Emblem means you agree to the{' '}
                <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
                  Terms of Service
                </Link>
                .
              </p>
            </div>

            {/* Right: live telemetry — the signature element */}
            <div className="animate-fade-up opacity-0 lg:col-span-5" style={{ animationDelay: '200ms' }}>
              <TelemetryGraph />
              {showStats && (
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08]">
                  {[
                    { value: formatStat(stats.keys_issued), label: 'Keys issued' },
                    { value: formatStat(stats.verified_runs), label: 'Verified runs' },
                    { value: formatStat(stats.hwid_resets), label: 'HWID resets' },
                    { value: `v${config.currentVersion}`, label: 'Version' },
                  ].map((s) => (
                    <div key={s.label} className="bg-paper px-5 py-4">
                      <div className="font-mono text-xl font-bold tracking-tight text-ink">{s.value}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
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

        {/* Spec sheet — technical facts stated like instrument readouts, not marketing cards */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:col-span-4 lg:h-fit">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Spec sheet</p>
              <h2 className="mt-3 text-3xl font-bold text-ink">What's actually running</h2>
              <p className="mt-4 max-w-sm text-sm text-neutral-400">
                Most script sellers ship a file and a Discord. Emblem ships a real backend — the same handshake your
                bank's login form would use, adapted for Roblox.
              </p>
            </div>
            <div className="lg:col-span-8">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] font-mono">
                {SPEC.map((f, i) => (
                  <div
                    key={f.title}
                    className={`flex items-start gap-5 p-6 transition hover:bg-white/[0.02] sm:items-center ${i !== 0 ? 'border-t border-white/[0.08]' : ''}`}
                  >
                    <span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.14em] text-signal">{f.label}</span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-neutral-300">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <div className="font-sans">
                      <h3 className="font-bold text-ink">{f.title}</h3>
                      <p className="mt-1 text-sm text-neutral-400">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Get started — the loadstring, on its own as an action rather than hero decoration */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:col-span-4 lg:h-fit">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Get started</p>
              <h2 className="mt-3 text-3xl font-bold text-ink">One line to run it</h2>
              <p className="mt-4 max-w-sm text-sm text-neutral-400">
                No key-setting step — the loader shows a box to enter your key the moment it runs.
              </p>
            </div>
            <div className="lg:col-span-8">
              <div className="rounded-2xl border border-white/10 bg-black/60 p-6 text-left shadow-xl backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-white">
                    <code>{exampleSnippet}</code>
                  </pre>
                  <CopyButton text={exampleSnippet} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {plans.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:sticky lg:top-28 lg:col-span-4 lg:h-fit">
                <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Get access</p>
                <h2 className="mt-3 text-3xl font-bold text-ink">Pricing</h2>
                <p className="mt-4 max-w-sm text-sm text-neutral-400">
                  One-time payment, no subscription. Every plan includes the same protected delivery — key auth, HWID
                  binding, replay protection.
                </p>
                <Link href="/pricing" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-ink underline underline-offset-4 hover:no-underline">
                  View full pricing <span aria-hidden>→</span>
                </Link>
              </div>
              <div className="lg:col-span-8">
                <div className="grid gap-5 sm:grid-cols-3">
                  {plans.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_40px_-24px_rgba(10,10,12,0.25)] backdrop-blur-md transition hover:-translate-y-1 hover:border-signal/30 hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_28px_50px_-20px_rgba(10,10,12,0.32)]">
                      <div className="font-bold text-ink">{p.name}</div>
                      <div className="mt-2 font-mono text-3xl font-bold tracking-tight text-ink">{formatPrice(p.price_cents, p.currency)}</div>
                      <div className="mt-1 font-mono text-xs uppercase tracking-wide text-neutral-500">{p.duration_days ? `${p.duration_days} days` : 'Lifetime'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:col-span-4 lg:h-fit">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Questions</p>
              <h2 className="mt-3 text-3xl font-bold text-ink">FAQ</h2>
              <p className="mt-4 max-w-sm text-sm text-neutral-400">
                Can't find what you're looking for? <Link href="/discord" className="text-ink underline underline-offset-4 hover:no-underline">Ask in Discord</Link>.
              </p>
            </div>
            <div className="lg:col-span-8">
              <div className="space-y-3">
                {FAQ.map((item) => (
                  <details key={item.q} className="group rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_14px_28px_-20px_rgba(10,10,12,0.2)] backdrop-blur-md transition hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_32px_-16px_rgba(10,10,12,0.28)]">
                    <summary className="cursor-pointer list-none font-semibold text-ink">{item.q}</summary>
                    <p className="mt-3 text-sm text-neutral-400">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.08] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-neutral-400 sm:flex-row">
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

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M9 1 3 9h4l-1 6 6-8H8l1-6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="4" y="1.5" width="8" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 12h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M8 1.5 13.5 3.5V7.5C13.5 11 11.2 13.3 8 14.5C4.8 13.3 2.5 11 2.5 7.5V3.5L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.75 8 7.25 9.5 10.25 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M1.5 8h3l1.5-4.5L9 12.5 10.5 8H14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
