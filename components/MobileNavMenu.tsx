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
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-ink transition hover:bg-white/[0.07]"
      >
        <span className="relative block h-4 w-4">
          <span
            className={`absolute left-0 top-0.5 h-[1.5px] w-4 bg-current transition-all duration-300 ease-out ${
              open ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span
            className={`absolute left-0 top-[7px] h-[1.5px] w-4 bg-current transition-all duration-200 ease-out ${
              open ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`absolute left-0 bottom-0.5 h-[1.5px] w-4 bg-current transition-all duration-300 ease-out ${
              open ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </span>
      </button>

      <div
        className={`absolute left-0 right-0 top-16 overflow-hidden border-b border-white/10 bg-paper/95 backdrop-blur-xl transition-all duration-300 ease-out ${
          open ? 'max-h-96 opacity-100' : 'pointer-events-none max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-1 px-6 py-4">
          {items.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${i * 30}ms` : '0ms' }}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-300 transition-all duration-200 ease-out hover:bg-white/[0.05] hover:text-ink ${
                open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
              }`}
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
                  className="rounded-full bg-ink px-4 py-2 text-center text-sm font-bold text-paper transition hover:bg-neutral-200"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
