'use client';

import { useState } from 'react';

/**
 * Drop your logo file at /public/emblem.png and it'll be used everywhere
 * automatically. Falls back to the letter badge if the file is missing
 * (so the site never shows a broken image icon).
 */
export function Logo({ size = 28 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="flex items-center justify-center rounded-md bg-ink font-black text-paper"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        E
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/emblem.png"
      alt="Emblem"
      width={size}
      height={size}
      className="rounded-md object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
