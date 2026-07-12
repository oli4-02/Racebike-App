"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  de: "DE",
  en: "EN",
  nl: "NL",
};

export default function LocaleSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={`flex overflow-hidden rounded-full border border-meewind-border text-xs ${className}`}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          aria-current={l === locale}
          className={`px-3 py-1 font-semibold ${
            l === locale
              ? "bg-meewind-accent text-meewind-accent-fg"
              : "text-meewind-fg-muted hover:text-meewind-fg"
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
