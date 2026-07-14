"use client";

import { useTranslations } from "next-intl";
import RegionPhoto from "./RegionPhoto";
import type { PlannedRoute } from "@/lib/types";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function WindHero({ windInfo, explanation }: { windInfo: PlannedRoute["windInfo"]; explanation?: string }) {
  const t = useTranslations("planner.result");
  if (!windInfo) return null;
  // Arrow points where the wind blows TO, i.e. the way it would push a rider.
  const towardsDeg = (windInfo.directionDeg + 180) % 360;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-meewind-accent/10 p-3">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/80 text-3xl leading-none text-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100"
        style={{ transform: `rotate(${towardsDeg}deg)` }}
      >
        ↑
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{t("windSpeed", { speed: windInfo.speedKmh.toFixed(0) })}</div>
        {explanation && <p className="text-xs text-meewind-fg-muted">{explanation}</p>}
      </div>
    </div>
  );
}

/**
 * The visually prominent top of the result: a representative regional
 * photo, a big wind-direction graphic (bigger and inline, not the small
 * map-corner overlay), and the two facts riders actually care about first
 * (distance, ride time) shown large. Everything else (knooppunten, road
 * type, GPX export) stays in RouteSummary below, de-emphasized.
 */
export default function ResultHero({ route }: { route: PlannedRoute }) {
  const t = useTranslations("planner.summary");
  const midpoint = route.geometry[Math.floor(route.geometry.length / 2)];

  return (
    <div className="flex flex-col gap-3">
      {midpoint && <RegionPhoto point={midpoint} />}

      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-meewind-border p-3 text-center">
          <div className="meewind-display text-2xl font-bold">
            {(route.totalDistanceM / 1000).toFixed(1)} km
          </div>
          <div className="text-xs text-meewind-fg-muted">{t("distance")}</div>
        </div>
        <div className="flex-1 rounded-lg border border-meewind-border p-3 text-center">
          <div className="meewind-display text-2xl font-bold">{formatDuration(route.totalDurationS)}</div>
          <div className="text-xs text-meewind-fg-muted">{t("duration")}</div>
        </div>
      </div>

      <WindHero windInfo={route.windInfo} explanation={route.wind?.explanation} />
    </div>
  );
}
