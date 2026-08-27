'use client';

import { useEffect, useRef, useState } from 'react';

const POINTS = 64;
const BASE_FPS = 238;

export function TelemetryGraph() {
  const [values, setValues] = useState<number[]>(() => Array.from({ length: POINTS }, () => BASE_FPS));
  const [fps, setFps] = useState(BASE_FPS);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion.current) return;

    let raf: number;
    let last = performance.now();
    const interval = 220;

    function tick(now: number) {
      if (now - last >= interval) {
        last = now;
        setValues((prev) => {
          const drift = (Math.random() - 0.5) * 10;
          const next = Math.max(220, Math.min(244, prev[prev.length - 1]! + drift));
          setFps(Math.round(next));
          return [...prev.slice(1), next];
        });
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const width = 480;
  const height = 200;
  const min = 210;
  const max = 250;
  const path = values
    .map((v, i) => {
      const x = (i / (POINTS - 1)) * width;
      const y = height - ((v - min) / (max - min)) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-5 shadow-xl backdrop-blur">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-4xl font-bold tabular-nums tracking-tight text-ink">
            {fps}
            <span className="ml-1.5 text-base font-medium text-neutral-500">fps</span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            frame time · live
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-signal/25 bg-signal/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          stable
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-32 w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="telemetry-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4A24C" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#D4A24C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#telemetry-fill)" />
        <path d={path} fill="none" stroke="#D4A24C" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      <div className="mt-3 flex justify-between font-mono text-[10px] text-neutral-600">
        <span>-60s</span>
        <span>now</span>
      </div>
    </div>
  );
}
