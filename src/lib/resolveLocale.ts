import { routing, type AppLocale } from "@/i18n/routing";

/** Narrows an arbitrary client-supplied string to a supported AppLocale, falling back to the default. */
export function resolveLocale(input: string | undefined | null): AppLocale {
  return (routing.locales as readonly string[]).includes(input ?? "")
    ? (input as AppLocale)
    : routing.defaultLocale;
}
