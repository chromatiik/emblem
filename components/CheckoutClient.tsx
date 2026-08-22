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
      <main className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      </main>
    );
  }

  if (plan === null) {
    return (
      <main className="relative z-10 mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-lg font-semibold text-ink">We couldn&apos;t find that plan.</p>
        <a href="/pricing" className="mt-4 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper">
          Back to pricing
        </a>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto grid max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[320px_1fr]">
      {/* Order summary sidebar */}
      <aside>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Order total</p>
        <p className="mt-1 text-4xl font-black text-ink">{formatPrice(plan.price_cents, plan.currency)}</p>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
          <div>
            <p className="font-semibold text-ink">{plan.name}</p>
            <p className="text-neutral-500">{plan.duration_days ? `${plan.duration_days} days` : 'Lifetime'}</p>
          </div>
          <p className="font-semibold text-ink">{formatPrice(plan.price_cents, plan.currency)}</p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
          <p className="text-neutral-500">Total</p>
          <p className="font-bold text-ink">{formatPrice(plan.price_cents, plan.currency)}</p>
        </div>
      </aside>

      {/* Main flow */}
      <div>
        <div className="mb-8 flex items-center gap-3 text-xs font-semibold text-neutral-500">
          <StepPip active={step === 'order'} done={step !== 'order'} label="Order Information" number={1} />
          <div className="h-px w-8 bg-white/10" />
          <StepPip
            active={step === 'crypto-pay' || step === 'paypal-info'}
            done={step === 'done'}
            label="Confirm & Pay"
            number={2}
          />
          <div className="h-px w-8 bg-white/10" />
          <StepPip active={step === 'done'} done={false} label="Receive Your Items" number={3} />
        </div>

        {step === 'order' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Payment</p>
              <div className="mt-3 space-y-2">
                <PaymentOption
                  selected={method === 'card'}
                  onSelect={() => setMethod('card')}
                  title="Debit & Credit Card"
                  subtitle="Processed securely by Stripe"
                />
                <PaymentOption
                  selected={method === 'crypto'}
                  onSelect={() => setMethod('crypto')}
                  title="Cryptocurrency"
                  subtitle="BTC, ETH, USDT, and more"
                />
                <PaymentOption
                  selected={method === 'paypal'}
                  onSelect={() => setMethod('paypal')}
                  title="PayPal"
                  subtitle="Manual — via Discord ticket"
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
                          ? 'border-ink bg-ink text-paper'
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
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
              I have read and agree to Emblem&apos;s{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-ink underline" onClick={(e) => e.stopPropagation()}>
                Terms of Service
              </a>
              .
            </label>

            <button
              onClick={handleContinue}
              disabled={submitting}
              className="w-full rounded-xl bg-ink py-3.5 text-sm font-bold text-paper transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {submitting ? 'Please wait…' : 'Continue to Payment'}
            </button>
            <p className="text-center text-xs text-neutral-500">🔒 All transactions are secure and encrypted.</p>
          </div>
        )}

        {step === 'crypto-pay' && cryptoPay && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Waiting for payment. This page updates automatically.
            </div>

            <div className="mt-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cryptoPay.qrCodeDataUrl} alt="Payment QR code" className="rounded-xl border border-white/10" />
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Address</p>
                <p className="truncate font-mono text-sm text-ink">{cryptoPay.payAddress}</p>
              </div>
              <CopyButton text={cryptoPay.payAddress} />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-xs uppercase text-neutral-500">Send exact amount</p>
              <p className="font-mono text-sm font-semibold text-ink">
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
              className="mt-6 inline-block rounded-xl bg-ink px-6 py-3 text-sm font-bold text-paper transition hover:bg-neutral-200"
            >
              Join Discord
            </a>
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-8 text-center">
            <p className="text-lg font-semibold text-ink">Payment received.</p>
            <p className="mt-1 text-sm text-neutral-400">Your key has been issued — check your dashboard.</p>
            <a
              href="/dashboard"
              className="mt-6 inline-block rounded-xl bg-ink px-6 py-3 text-sm font-bold text-paper transition hover:bg-neutral-200"
            >
              Go to dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

function StepPip({ active, done, label, number }: { active: boolean; done: boolean; label: string; number: number }) {
  return (
    <div className={`flex items-center gap-2 ${active || done ? 'text-ink' : ''}`}>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? 'bg-emerald-500 text-paper' : active ? 'bg-ink text-paper' : 'border border-white/15 text-neutral-500'
        }`}
      >
        {done ? '✓' : number}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function PaymentOption({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${
        selected ? 'border-ink bg-white/[0.04]' : 'border-white/10 hover:bg-white/[0.03]'
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
          selected ? 'border-ink bg-ink' : 'border-white/20'
        }`}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-paper" />}
      </span>
    </button>
  );
}

export function CheckoutClient() {
  return (
    <ToastProvider>
      <CheckoutInner />
    </ToastProvider>
  );
}
