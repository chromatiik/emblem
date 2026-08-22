'use client';

import { useState } from 'react';
import Link from 'next/link';

type NavItem = { href: string; label: string };

export function MobileNavMenu({ items, username }: { items: NavItem[]; username: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-ink"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-16 border-b border-white/10 bg-paper/95 px-6 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.05] hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-white/10 pt-3">
              {username ? (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-ink"
                >
                  {username}
                </Link>
              ) : (
                <div className="flex flex-col gap-2 px-3">
                  <Link href="/login" onClick={() => setOpen(false)} className="text-sm font-semibold text-neutral-300">
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-ink px-4 py-2 text-center text-sm font-bold text-paper"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
