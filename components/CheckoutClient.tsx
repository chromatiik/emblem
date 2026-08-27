'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ToastProvider, useToast } from '@/components/Toast';
import { CopyButton } from '@/components/CopyButton';
import { formatPrice } from '@/lib/format';

type Plan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  duration_days: number | null;
};

type PaymentMethod = 'card' | 'crypto' | 'paypal';
type Step = 'order' | 'crypto-pay' | 'paypal-info' | 'done';

const CRYPTO_CURRENCIES = [
  { code: 'btc', label: 'Bitcoin (BTC)' },
  { code: 'eth', label: 'Ethereum (ETH)' },
  { code: 'usdttrc20', label: 'USDT (TRC20)' },
  { code: 'ltc', label: 'Litecoin (LTC)' },
];

const STEPS: { key: Step[]; label: string }[] = [
  { key: ['order'], label: 'Order' },
  { key: ['crypto-pay', 'paypal-info'], label: 'Pay' },
  { key: ['done'], label: 'Delivered' },
];

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const planId = params.get('plan');

  const [plan, setPlan] = useState<Plan | null | undefined>(undefined); // undefined = loading, null = not found
  const [step, setStep] = useState<Step>('order');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [cryptoCurrency, setCryptoCurrency] = useState('btc');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [cryptoPay, setCryptoPay] = useState<{
    purchaseId: string;
    payAddress: string;
    payAmount: number;
    payCurrency: string;
    qrCodeDataUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!planId) {
      setPlan(null);
      return;
    }
    fetch('/api/plans')
      .then((r) => r.json())
      .then((d) => setPlan((d.plans as Plan[]).find((p) => p.id === planId) ?? null))
      .catch(() => setPlan(null));
  }, [planId]);

  // Poll purchase status once a crypto payment is created — DB-only on
  // our side, doesn't hit NOWPayments directly (their webhook is the
  // actual source of truth for status changes).
  useEffect(() => {
    if (step !== 'crypto-pay' || !cryptoPay) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status/${cryptoPay.purchaseId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'paid') {
          setStep('done');
          clearInterval(interval);
        }
      } catch {
        // Transient network error — just try again next tick.
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [step, cryptoPay]);

  async function handleContinue() {
    if (!plan) return;
    if (!agreed) {
      toast.push('Please agree to the Terms of Service first.', 'info');
      return;
    }

    setSubmitting(true);
    try {
      if (method === 'card') {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.id }),
        });
        const data = await res.json();
        if (res.status === 401) {
          router.push(`/login?next=/checkout?plan=${plan.id}`);
          return;
        }
        if (!res.ok) {
          toast.push(data.error || 'Could not start checkout.', 'error');
          return;
        }
        window.location.href = data.checkoutUrl;
        return;
      }

      if (method === 'crypto') {
        const res = await fetch('/api/checkout/crypto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.id, payCurrency: cryptoCurrency }),
        });
        const data = await res.json();
        if (res.status === 401) {
          router.push(`/login?next=/checkout?plan=${plan.id}`);
          return;
        }
        if (!res.ok) {
          toast.push(data.error || 'Could not start crypto checkout.', 'error');
          return;
        }
        setCryptoPay(data);
        setStep('crypto-pay');
        return;
      }

      // PayPal: no automated payment — just show manual fulfillment instructions.
      setStep('paypal-info');
    } finally {
      setSubmitting(false);
    }
  }

  if (plan === undefined) {
    return (
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-16">
        <div className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      </main>
    );
  }

  if (plan === null) {
    return (
      <main className="relative z-10 mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-lg font-semibold text-ink">We couldn&apos;t find that plan.</p>
        <a href="/pricing" className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-paper">
          Back to pricing
        </a>
      </main>
    );
  }

  const activeGroupIndex = STEPS.findIndex((s) => s.key.includes(step));

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-6 py-16">
      {/* Progress bar replaces the old small numbered pips — a filled
          track reads at a glance, and each label sits directly under its
          own segment instead of floating beside a circle. */}
      <div className="mb-10">
        <div className="flex h-1 gap-1 overflow-hidden rounded-full bg-white/[0.06]">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`flex-1 rounded-full transition-colors ${
                i < activeGroupIndex ? 'bg-signal' : i === activeGroupIndex ? 'bg-signal/50' : 'bg-transparent'
              }`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] uppercase tracking-wide">
          {STEPS.map((s, i) => (
            <span key={s.label} className={i <= activeGroupIndex ? 'text-signal' : 'text-neutral-600'}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* Order summary — spec-sheet style rows instead of a plain list,
            matching the mono-labeled pattern used across the rest of the
            site rather than being its own one-off layout. */}
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal">Order</p>
          <p className="mt-1 font-mono text-3xl font-black tracking-tight text-ink">{formatPrice(plan.price_cents, plan.currency)}</p>

          <div className="mt-5 space-y-3 border-t border-white/[0.08] pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">Plan</span>
              <span className="font-semibold text-ink">{plan.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">Duration</span>
              <span className="text-neutral-300">{plan.duration_days ? `${plan.duration_days} days` : 'Lifetime'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 text-sm">
              <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">Total</span>
              <span className="font-mono font-bold text-ink">{formatPrice(plan.price_cents, plan.currency)}</span>
            </div>
          </div>
        </aside>

        {/* Main flow */}
        <div>
          {step === 'order' && (
            <div className="space-y-6">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-signal">Payment method</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <PaymentOption
                    selected={method === 'card'}
                    onSelect={() => setMethod('card')}
                    title="Card"
                    subtitle="Via Stripe"
                    icon={<CardIcon className="h-5 w-5" />}
                  />
                  <PaymentOption
                    selected={method === 'crypto'}
                    onSelect={() => setMethod('crypto')}
                    title="Crypto"
                    subtitle="BTC, ETH, USDT+"
                    icon={<CoinIcon className="h-5 w-5" />}
                  />
                  <PaymentOption
                    selected={method === 'paypal'}
                    onSelect={() => setMethod('paypal')}
                    title="PayPal"
                    subtitle="Via Discord"
                    icon={<PaypalIcon className="h-5 w-5" />}
                  />
                </div>

                {method === 'crypto' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CRYPTO_CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setCryptoCurrency(c.code)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          cryptoCurrency === c.code
                            ? 'border-signal bg-signal text-paper'
                            : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 text-sm text-neutral-300">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-signal" />
                I have read and agree to Emblem&apos;s{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-ink underline" onClick={(e) => e.stopPropagation()}>
                  Terms of Service
                </a>
                .
              </label>

              <button
                onClick={handleContinue}
                disabled={submitting}
                className="w-full rounded-xl bg-signal py-3.5 text-sm font-bold text-paper transition hover:bg-signal/90 disabled:opacity-50"
              >
                {submitting ? 'Please wait…' : 'Continue to Payment'}
              </button>
              <p className="text-center font-mono text-xs text-neutral-500">All transactions are secure and encrypted.</p>
            </div>
          )}

          {step === 'crypto-pay' && cryptoPay && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
                Waiting for payment. This page updates automatically.
              </div>

              <div className="mt-6 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cryptoPay.qrCodeDataUrl} alt="Payment QR code" className="rounded-xl border border-white/10" />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-neutral-500">Address</p>
                  <p className="truncate font-mono text-sm text-ink">{cryptoPay.payAddress}</p>
                </div>
                <CopyButton text={cryptoPay.payAddress} />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-signal/20 bg-signal/[0.06] px-4 py-3">
                <p className="font-mono text-xs uppercase text-neutral-400">Send exact amount</p>
                <p className="font-mono text-sm font-semibold text-signal">
                  {cryptoPay.payAmount} {cryptoPay.payCurrency.toUpperCase()}
                </p>
              </div>

              <ol className="mt-6 space-y-2 text-sm text-neutral-400">
                <li>1. Send the exact amount above to the address shown.</li>
                <li>2. Your key will be issued automatically once the network confirms payment.</li>
                <li>3. Only send {cryptoPay.payCurrency.toUpperCase()} on its native network — other coins/networks will be lost.</li>
              </ol>
            </div>
          )}

          {step === 'paypal-info' && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="font-semibold text-ink">PayPal purchases are handled manually.</p>
              <ol className="mt-4 space-y-2 text-sm text-neutral-400">
                <li>1. Join our Discord server.</li>
                <li>2. Open a support ticket and mention you&apos;d like to pay with PayPal for {plan.name}.</li>
                <li>3. We&apos;ll send payment details, then generate and bind a key to your account once payment is received.</li>
              </ol>
              <a
                href="/discord"
                className="mt-6 inline-block rounded-xl bg-signal px-6 py-3 text-sm font-bold text-paper transition hover:bg-signal/90"
              >
                Join Discord
              </a>
            </div>
          )}

          {step === 'done' && (
            <div className="rounded-2xl border border-signal/25 bg-signal/[0.06] p-8 text-center">
              <p className="text-lg font-semibold text-ink">Payment received.</p>
              <p className="mt-1 text-sm text-neutral-400">Your key has been issued — check your dashboard.</p>
              <a
                href="/dashboard"
                className="mt-6 inline-block rounded-xl bg-signal px-6 py-3 text-sm font-bold text-paper transition hover:bg-signal/90"
              >
                Go to dashboard
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function PaymentOption({
  selected,
  onSelect,
  title,
  subtitle,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-start gap-2 rounded-xl border px-4 py-3.5 text-left transition ${
        selected ? 'border-signal/40 bg-signal/[0.06]' : 'border-white/10 hover:bg-white/[0.03]'
      }`}
    >
      <span className={selected ? 'text-signal' : 'text-neutral-400'}>{icon}</span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </button>
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

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v6M6 6.5h2.5a1.2 1.2 0 0 1 0 2.4H6.5a1.2 1.2 0 0 0 0 2.4H10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function PaypalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M4 2.5h5c2 0 3.2 1.1 3.2 2.9 0 2.3-1.7 3.9-4.3 3.9H6.2L5.5 13.5H3L4 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckoutClient() {
  return (
    <ToastProvider>
      <CheckoutInner />
    </ToastProvider>
  );
}
