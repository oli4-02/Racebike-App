"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import type { DestinationSuggestion, LatLon } from "@/lib/types";

const MiniRouteMap = dynamic(() => import("./MiniRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-28 w-full rounded bg-meewind-bg-raised animate-pulse" />
  ),
});

export default function DestinationSuggestions({
  start,
  suggestions,
  loading,
  onSelect,
}: {
  start: LatLon;
  suggestions: DestinationSuggestion[];
  loading: boolean;
  onSelect: (s: DestinationSuggestion) => void;
}) {
  const t = useTranslations("planner.suggestions");

  if (loading) {
    return <p className="text-xs text-meewind-fg-muted">{t("loading")}</p>;
  }
  if (suggestions.length === 0) {
    return <p className="text-xs text-meewind-fg-muted">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <div
          key={s.name}
          className="rounded-md border border-meewind-border overflow-hidden"
        >
          {s.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.imageUrl} alt={s.name} className="w-full h-20 object-cover" />
          )}
          {s.previewGeometry.length > 1 && (
            <MiniRouteMap
              start={start}
              destination={{ lat: s.lat, lon: s.lon }}
              geometry={s.previewGeometry}
            />
          )}
          <div className="p-2 flex flex-col gap-1">
            <span className="text-sm font-medium">{s.name}</span>
            <p className="text-xs text-meewind-fg-muted">{s.reason}</p>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="mt-1 rounded-md bg-meewind-accent text-meewind-accent-fg text-xs font-medium py-1.5"
            >
              {t("planButton")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
