'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info' };
type ToastContextValue = { push: (message: string, kind?: Toast['kind']) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur ${
              t.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-950/80 text-emerald-300'
                : t.kind === 'error'
                ? 'border-red-500/30 bg-red-950/80 text-red-300'
                : 'border-white/10 bg-black/80 text-ink'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
