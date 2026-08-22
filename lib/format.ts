/**
 * Formats a price stored in cents/pence using the plan's actual currency
 * code, rather than assuming a symbol. Safe to use in both client and
 * server components — no 'server-only' import here.
 */
export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    // Unknown/invalid currency code — fall back to a plain number so this
    // never throws and breaks a page over a formatting edge case.
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
