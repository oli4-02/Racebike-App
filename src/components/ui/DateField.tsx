"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

/** Styled wrapper around a native date input -- custom icon/border/focus ring, click-anywhere-in-the-field-to-open via showPicker() where supported. */
export default function DateField({
  id,
  value,
  onChange,
  label,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (el && typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        // Some browsers throw if not called from a direct user gesture on
        // the input itself; the native click-to-open fallback still works.
      }
    }
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-1.5">
          {label}
        </label>
      )}
      <div
        onClick={openPicker}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-meewind-border bg-meewind-bg-raised px-3 py-2.5 focus-within:ring-2 focus-within:ring-meewind-accent/60"
      >
        <svg
          className="h-4 w-4 shrink-0 text-meewind-accent"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <rect x="3" y="4" width="14" height="13" rx="2" />
          <path d="M3 8h14M7 2v3M13 2v3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer bg-transparent text-sm text-meewind-fg outline-none [color-scheme:dark]"
        />
      </div>
    </div>
  );
}
