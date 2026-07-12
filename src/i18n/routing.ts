import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "en", "nl"],
  defaultLocale: "nl",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
