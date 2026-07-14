"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import type { LatLon, RoundTripAlternative } from "@/lib/types";

const MiniRouteMap = dynamic(() => import("@/components/MiniRouteMap"), {
  ssr: false,
  loading: () => <div className="h-28 w-full rounded bg-meewind-bg-raised animate-pulse" />,
});

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/**
 * Pure presentation: the 5 roundtrip options computed by the main
 * "Route planen" submit (see page.tsx), for the rider to pick from. Used
 * to own its own fetch/loading/button behind a separate "show variants"
 * entry point -- now the fetch itself lives in page.tsx's handleSubmit, so
 * this only renders the list and reports a selection back up.
 */
export default function RoundTripAlternatives({
  start,
  alternatives,
  selectedIndex,
  onSelect,
}: {
  start: LatLon;
  alternatives: RoundTripAlternative[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations("planner.alternatives");

  return (
    <div className="flex flex-col gap-2">
      <span className="meewind-display text-sm">{t("chooseHeading")}</span>
      <div className="flex flex-col gap-2">
        {alternatives.map((alt, i) => (
          <div
            key={i}
            className={`rounded-md border overflow-hidden shrink-0 ${
              selectedIndex === i ? "border-meewind-accent" : "border-meewind-border"
            }`}
          >
            <MiniRouteMap start={start} destination={start} geometry={alt.route.geometry} />
            <div className="p-2 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{alt.directionLabel}</span>
                <span className="text-xs text-meewind-fg-muted">
                  {(alt.route.totalDistanceM / 1000).toFixed(0)} km ·{" "}
                  {formatDuration(alt.route.totalDurationS)}
                </span>
              </div>
              <span className="text-xs text-meewind-accent">{alt.reason}</span>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="mt-1 rounded-md bg-meewind-accent text-meewind-accent-fg text-xs font-medium py-1.5"
              >
                {selectedIndex === i ? t("chosen") : t("choose")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
