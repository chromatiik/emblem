'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If set, renders a text input and resolves with its value (or null if cancelled) instead of a boolean. */
  inputPlaceholder?: string;
};

type ConfirmContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  promptText: (message: string, options?: Omit<ConfirmOptions, 'inputPlaceholder'> & { placeholder?: string }) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type DialogState = { message: string; options: ConfirmOptions; wantsInput: boolean };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const resolveRef = useRef<((value: any) => void) | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    setState({ message, options, wantsInput: false });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const promptText = useCallback((message: string, options: (Omit<ConfirmOptions, 'inputPlaceholder'> & { placeholder?: string }) = {}) => {
    setInputValue('');
    setState({ message, options: { ...options, inputPlaceholder: options.placeholder }, wantsInput: true });
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function respond(value: boolean) {
    const wasInput = state?.wantsInput;
    const captured = inputValue;
    setState(null);
    if (wasInput) {
      resolveRef.current?.(value ? captured : null);
    } else {
      resolveRef.current?.(value);
    }
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={{ confirm, promptText }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => respond(false)}>
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0f12] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {state.options.title && <h3 className="font-bold text-ink">{state.options.title}</h3>}
            <p className={`text-sm text-neutral-300 ${state.options.title ? 'mt-2' : ''}`}>{state.message}</p>
            {state.wantsInput && (
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') respond(true);
                }}
                placeholder={state.options.inputPlaceholder}
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => respond(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.05]"
              >
                {state.options.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => respond(true)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  state.options.danger
                    ? 'bg-red-500/90 text-white hover:bg-red-500'
                    : 'bg-ink text-paper hover:bg-neutral-200'
                }`}
              >
                {state.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

export function usePromptText() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('usePromptText must be used within ConfirmProvider');
  return ctx.promptText;
}
