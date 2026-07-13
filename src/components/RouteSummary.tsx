"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fetchRoadTypeBreakdown } from "@/lib/apiClient";
import { buildGpx } from "@/lib/gpx";
import type { PlannedRoute, POI, RoadTypeBreakdown } from "@/lib/types";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

const ROAD_TYPE_SEGMENTS: { key: keyof RoadTypeBreakdown; color: string }[] = [
  { key: "cyclewayPct", color: "bg-meewind-accent" },
  { key: "residentialPct", color: "bg-amber-500" },
  { key: "mainRoadPct", color: "bg-red-500" },
  { key: "otherPct", color: "bg-meewind-fg-muted" },
];

function RoadTypeSummary({ geometry }: { geometry: PlannedRoute["geometry"] }) {
  const t = useTranslations("planner.summary.roadTypes");
  const locale = useLocale();
  const [breakdown, setBreakdown] = useState<RoadTypeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRoadTypeBreakdown(geometry, locale)
      .then((b) => {
        if (cancelled) return;
        setBreakdown(b);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBreakdown(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geometry, locale]);

  if (loading) return <p className="text-xs text-meewind-fg-muted">{t("loading")}</p>;
  if (!breakdown) return null;

  const visibleSegments = ROAD_TYPE_SEGMENTS.filter((s) => breakdown[s.key] > 0);
  if (visibleSegments.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-meewind-fg-muted">{t("title")}</span>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {visibleSegments.map((s) => (
          <div key={s.key} className={s.color} style={{ width: `${breakdown[s.key]}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-meewind-fg-muted">
        {visibleSegments.map((s) => (
          <span key={s.key}>
            {t(s.key)} {breakdown[s.key]}%
          </span>
        ))}
      </div>
    </div>
  );
}

function routeIdentity(route: PlannedRoute): string {
  const first = route.geometry[0];
  const last = route.geometry[route.geometry.length - 1];
  return `${route.geometry.length}-${first?.lat}-${first?.lon}-${last?.lat}-${last?.lon}`;
}

function downloadGpx(route: PlannedRoute, pois: POI[]) {
  const gpx = buildGpx({
    name: `Meewind ${new Date().toISOString().slice(0, 10)}`,
    geometry: route.geometry,
    pois,
  });
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "route.gpx";
  a.click();
  URL.revokeObjectURL(url);
}

export default function RouteSummary({
  route,
  pois,
}: {
  route: PlannedRoute;
  pois: POI[];
}) {
  const t = useTranslations("planner.summary");

  return (
    <div className="flex flex-col gap-3 rounded-md border border-meewind-border p-3 text-sm">
      <div className="flex justify-between">
        <span className="text-meewind-fg-muted">{t("distance")}</span>
        <span className="font-medium">
          {(route.totalDistanceM / 1000).toFixed(1)} km
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-meewind-fg-muted">{t("duration")}</span>
        <span className="font-medium">
          {formatDuration(route.totalDurationS)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-meewind-fg-muted">{t("knooppunten")}</span>
        <span className="font-medium">
          {route.knooppunten.map((k) => k.ref).join(" – ") || "–"}
        </span>
      </div>

      {route.wind && (
        <div className="rounded-md bg-meewind-accent/10 p-2 text-xs text-meewind-fg">
          {route.wind.explanation}
        </div>
      )}

      <RoadTypeSummary key={routeIdentity(route)} geometry={route.geometry} />

      <button
        type="button"
        onClick={() => downloadGpx(route, pois)}
        className="rounded-md border border-meewind-border py-2 text-sm font-medium hover:bg-meewind-bg-raised"
      >
        {t("gpxExport")}
      </button>
    </div>
  );
}
