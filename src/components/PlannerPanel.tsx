"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
    >
      <path d="M5 12l5-5 5 5" />
    </svg>
  );
}

/**
 * Floating, collapsible panel that replaces the old fixed sidebar -- a
 * bottom sheet on narrow viewports, a card floating over the top-left of
 * the map on wider ones. Collapsing only ever shrinks it to the header bar
 * (never changes width), so the same class logic works at both breakpoints.
 * Content is a single scrollable flow (no tabs) -- the caller is responsible
 * for ordering essentials-first, with anything non-essential tucked behind
 * its own collapsible section.
 */
export default function PlannerPanel({
  title,
  subtitle,
  backLabel,
  collapsed,
  onToggleCollapsed,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  backLabel: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "fixed z-[1100] flex flex-col overflow-hidden rounded-t-2xl border border-meewind-border",
        "bg-meewind-bg-raised/95 shadow-2xl backdrop-blur-sm transition-all duration-300 ease-out",
        "inset-x-0 bottom-0",
        "md:inset-x-auto md:left-4 md:top-4 md:w-[380px] md:rounded-2xl",
        collapsed ? "h-16 md:h-16" : "h-[82vh] md:h-auto md:bottom-4",
      ].join(" ")}
    >
      {/*
        A <button> can't legally contain other interactive elements (the
        back link, the locale-switcher buttons) -- nesting them caused a
        hydration mismatch (browsers silently un-nest invalid markup,
        producing a different DOM than React expects) that broke the panel
        after the first interaction. This is a plain, click-to-toggle row
        instead, with its own explicit icon button for keyboard/AT users.
      */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-meewind-border px-4 py-3">
        <div
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={onToggleCollapsed}
        >
          {!collapsed && (
            <Link
              href="/"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-meewind-accent hover:underline"
            >
              {backLabel}
            </Link>
          )}
          <span className="meewind-display block truncate text-base">{title}</span>
          {!collapsed && (
            <span className="block truncate text-xs text-meewind-fg-muted">{subtitle}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-meewind-border text-meewind-fg-muted"
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-meewind-border p-4">{footer}</div>}
        </>
      )}
    </div>
  );
}
