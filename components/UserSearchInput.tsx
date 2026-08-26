'use client';

import { useEffect, useRef, useState } from 'react';

type UserSuggestion = { id: string; username: string; email: string };

export function UserSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Search by username or email…',
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (user: UserSuggestion) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setSuggestions((data.users ?? []).slice(0, 6));
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
      />

      {open && (loading || suggestions.length > 0) && (
        <div className="absolute z-50 mt-1.5 w-full origin-top animate-scale-in overflow-hidden rounded-lg border border-white/10 bg-[#101114] shadow-xl">
          {loading && suggestions.length === 0 ? (
            <div className="px-3.5 py-2.5 text-sm text-neutral-500">Searching…</div>
          ) : (
            suggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSelect(u);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-neutral-300 transition hover:bg-white/[0.05]"
              >
                <span className="font-semibold text-ink">{u.username}</span>
                <span className="text-xs text-neutral-500">{u.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
