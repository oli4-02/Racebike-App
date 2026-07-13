"use client";

import type { ReactNode } from "react";

/**
 * Styled wrapper around a native <select> -- keeps native keyboard/a11y/
 * mobile behavior (a hand-rolled listbox is a real accessibility and
 * mobile-Safari minefield) but replaces the browser-default chrome with the
 * design-token look and a custom chevron.
 */
export default function Select({
  id,
  value,
  onChange,
  options,
  label,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: ReactNode;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-lg border border-meewind-border bg-meewind-bg-raised px-3 py-2.5 pr-9 text-sm text-meewind-fg focus:outline-none focus:ring-2 focus:ring-meewind-accent/60"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-meewind-fg-muted"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
