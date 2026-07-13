"use client";

import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchSignatureRoutes, planSignatureRoute } from "@/lib/apiClient";
import { approximateLoopGeometry, distance } from "@/lib/geo";
import { LANDSCAPE_EMOJI, useLandscapeLabels } from "@/lib/scenicCorridors";
import type {
  LandscapeType,
  LatLon,
  Priorities,
  SignatureRoute,
  SignatureRoutePlan,
} from "@/lib/types";

const MiniRouteMap = dynamic(() => import("./MiniRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-28 w-full rounded bg-meewind-bg-raised animate-pulse" />
  ),
});

const DEFAULT_PREVIEW_KM = 50;
// Mirrors FAR_THRESHOLD_M in /api/signature-route/route.ts, just for the train-travel hint below.
const FAR_THRESHOLD_KM = 25;

export default function SignatureRoutePicker({
  start,
  distanceKm,
  date,
  priorities,
  avgSpeedKmh,
  onDistanceKmChange,
  onPlanned,
}: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities: Priorities;
  avgSpeedKmh: number;
  onDistanceKmChange: (km: number) => void;
  onPlanned: (result: SignatureRoutePlan) => void;
}) {
  const t = useTranslations("planner.signature");
  const locale = useLocale();
  const landscapeLabels = useLandscapeLabels();
  const landscapeTypes = Object.keys(landscapeLabels) as LandscapeType[];
  const [routes, setRoutes] = useState<SignatureRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [filter, setFilter] = useState<LandscapeType | null>(null);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSignatureRoutes(locale)
      .then((r) => !cancelled && setRoutes(r))
      .catch(() => !cancelled && setError(t("errorLoad")))
      .finally(() => !cancelled && setLoadingRoutes(false));
    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  async function handlePick(route: SignatureRoute) {
    setPlanningId(route.id);
    setError(null);
    const usedDistanceKm = route.approxDistanceKm ?? distanceKm;
    if (route.approxDistanceKm) onDistanceKmChange(route.approxDistanceKm);
    try {
      const result = await planSignatureRoute({
        routeId: route.id,
        start,
        distanceKm: usedDistanceKm,
        date,
        priorities,
        avgSpeedKmh,
        locale,
      });
      onPlanned(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorPlan"));
    } finally {
      setPlanningId(null);
    }
  }

  const withDistance = routes.map((r) => ({
    ...r,
    distFromStartKm: distance(start, r.center) / 1000,
  }));
  const visible = (filter ? withDistance.filter((r) => r.landscapeType === filter) : withDistance).sort(
    (a, b) => a.distFromStartKm - b.distFromStartKm
  );

  return (
    <div className="flex flex-col gap-2">
      {loadingRoutes && <p className="text-xs text-meewind-fg-muted">{t("loading")}</p>}

      {!loadingRoutes && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`rounded-full border px-2 py-0.5 text-xs ${
              filter === null
                ? "bg-meewind-accent text-meewind-accent-fg border-meewind-accent"
                : "border-meewind-border"
            }`}
            onClick={() => setFilter(null)}
          >
            {t("all")}
          </button>
          {landscapeTypes.map((lt) => (
            <button
              key={lt}
              type="button"
              className={`rounded-full border px-2 py-0.5 text-xs ${
                filter === lt
                  ? "bg-meewind-accent text-meewind-accent-fg border-meewind-accent"
                  : "border-meewind-border"
              }`}
              onClick={() => setFilter(lt)}
            >
              {LANDSCAPE_EMOJI[lt]} {landscapeLabels[lt]}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-400 whitespace-pre-wrap break-words">{error}</p>}

      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {visible.map((r) => (
          <div
            key={r.id}
            className="rounded-md border border-meewind-border overflow-hidden shrink-0"
          >
            <MiniRouteMap
              start={r.center}
              destination={r.center}
              geometry={approximateLoopGeometry(r.center, r.approxDistanceKm ?? DEFAULT_PREVIEW_KM)}
            />
            <div className="p-2 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-xs text-meewind-fg-muted">
                  {LANDSCAPE_EMOJI[r.landscapeType]} {landscapeLabels[r.landscapeType]}
                </span>
              </div>
              <p className="text-xs text-meewind-fg-muted">
                {r.province} · {r.startRegionName} ·{" "}
                {r.approxDistanceKm ? `≈ ${r.approxDistanceKm} km` : t("variableDistance")}
              </p>
              <p className="text-xs text-meewind-fg-muted">
                {t("distFromStart", { km: r.distFromStartKm.toFixed(0) })} ·{" "}
                {r.distFromStartKm > FAR_THRESHOLD_KM ? t("trainSuggested") : t("directStart")}
              </p>
              <p className="text-xs text-meewind-fg-muted">{r.description}</p>
              <button
                type="button"
                onClick={() => handlePick(r)}
                disabled={planningId !== null}
                className="mt-1 rounded-md bg-meewind-accent text-meewind-accent-fg text-xs font-medium py-1.5 disabled:opacity-50"
              >
                {planningId === r.id ? t("planning") : t("plan")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
