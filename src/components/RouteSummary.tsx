"use client";

import { useTranslations } from "next-intl";
import { buildGpx } from "@/lib/gpx";
import type { PlannedRoute, POI } from "@/lib/types";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
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
