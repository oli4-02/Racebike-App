"use client";

import type { ReactNode } from "react";

/**
 * Generic collapsed-by-default section: a single flow uses this instead of
 * separate tabs to keep non-essential settings out of the way without
 * hiding them behind a whole extra step.
 */
export default function Collapsible({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-meewind-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="block truncate text-xs text-meewind-fg-muted">{subtitle}</span>
          )}
        </span>
        <span className={`shrink-0 text-meewind-fg-muted transition-transform ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {open && <div className="flex flex-col gap-5 border-t border-meewind-border p-3">{children}</div>}
    </div>
  );
}
