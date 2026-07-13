"use client";

import { useTranslations } from "next-intl";

/**
 * Shown in place of a priorities-driven suggestion feature (5 roundtrip
 * variants, one-way destination suggestions) until the rider has looked at
 * the "Deine Vorlieben" tab at least once -- otherwise these get computed
 * against whatever priorities happen to still be at their defaults, and the
 * rider has to redo the search after adjusting them anyway.
 */
export default function PreferencesGateHint({ onGoToPreferences }: { onGoToPreferences: () => void }) {
  const t = useTranslations("planner.form");
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-meewind-border p-3 text-xs text-meewind-fg-muted">
      <span>{t("preferencesGateHint")}</span>
      <button
        type="button"
        onClick={onGoToPreferences}
        className="self-start rounded-md border border-meewind-accent px-3 py-1.5 font-medium text-meewind-accent"
      >
        {t("goToPreferences")}
      </button>
    </div>
  );
}
