"use client";

import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState } from "react";
import { planRouteAlternatives } from "@/lib/apiClient";
import type { LatLon, PlannedRoute, POICategory, Priorities, RoundTripAlternative } from "@/lib/types";

const MiniRouteMap = dynamic(() => import("./MiniRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-28 w-full rounded bg-meewind-bg-raised animate-pulse" />
  ),
});

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export default function RouteAlternativesPicker({
  start,
  distanceKm,
  date,
  priorities,
  direction,
  avgSpeedKmh,
  poiCategories,
  avoidMainRoads,
  onPlanned,
}: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities: Priorities;
  direction: number | null;
  avgSpeedKmh: number;
  poiCategories: POICategory[];
  avoidMainRoads: boolean;
  onPlanned: (route: PlannedRoute) => void;
}) {
  const t = useTranslations("planner.alternatives");
  const locale = useLocale();
  const [alternatives, setAlternatives] = useState<RoundTripAlternative[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  async function loadAlternatives() {
    setLoading(true);
    setError(null);
    setSelectedIndex(null);
    try {
      const result = await planRouteAlternatives(
        {
          start,
          mode: "roundtrip",
          distanceKm,
          date,
          priorities,
          direction,
          avgSpeedKmh,
          poiCategories,
          avoidMainRoads,
        },
        locale
      );
      setAlternatives(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={loadAlternatives}
        disabled={loading}
        className="rounded-md border border-meewind-border py-2 text-xs font-medium disabled:opacity-50"
      >
        {loading ? t("loading") : t("show")}
      </button>

      {error && <p className="text-xs text-red-400 whitespace-pre-wrap break-words">{error}</p>}

      {alternatives && (
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
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
                  onClick={() => {
                    setSelectedIndex(i);
                    onPlanned(alt.route);
                  }}
                  className="mt-1 rounded-md bg-meewind-accent text-meewind-accent-fg text-xs font-medium py-1.5"
                >
                  {selectedIndex === i ? t("chosen") : t("choose")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
