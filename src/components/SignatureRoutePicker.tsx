"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchSignatureRoutes, planSignatureRoute } from "@/lib/apiClient";
import { approximateLoopGeometry } from "@/lib/geo";
import { LANDSCAPE_EMOJI, LANDSCAPE_LABELS } from "@/lib/scenicCorridors";
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
    <div className="h-28 w-full rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
  ),
});

const LANDSCAPE_TYPES = Object.keys(LANDSCAPE_LABELS) as LandscapeType[];
const DEFAULT_PREVIEW_KM = 50;

export default function SignatureRoutePicker({
  start,
  distanceKm,
  date,
  priorities,
  onDistanceKmChange,
  onPlanned,
}: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities: Priorities;
  onDistanceKmChange: (km: number) => void;
  onPlanned: (result: SignatureRoutePlan) => void;
}) {
  const [routes, setRoutes] = useState<SignatureRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [filter, setFilter] = useState<LandscapeType | null>(null);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSignatureRoutes()
      .then((r) => !cancelled && setRoutes(r))
      .catch(() => !cancelled && setError("Routen-Liste konnte nicht geladen werden."))
      .finally(() => !cancelled && setLoadingRoutes(false));
    return () => {
      cancelled = true;
    };
  }, []);

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
      });
      onPlanned(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signature-Route fehlgeschlagen.");
    } finally {
      setPlanningId(null);
    }
  }

  const visible = filter ? routes.filter((r) => r.landscapeType === filter) : routes;

  return (
    <div className="flex flex-col gap-2">
      {loadingRoutes && <p className="text-xs text-zinc-500">Lade Signature-Routen…</p>}

      {!loadingRoutes && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`rounded-full border px-2 py-0.5 text-xs ${
              filter === null
                ? "bg-blue-600 text-white border-blue-600"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
            onClick={() => setFilter(null)}
          >
            Alle
          </button>
          {LANDSCAPE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-full border px-2 py-0.5 text-xs ${
                filter === t
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
              onClick={() => setFilter(t)}
            >
              {LANDSCAPE_EMOJI[t]} {LANDSCAPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 whitespace-pre-wrap break-words">{error}</p>}

      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {visible.map((r) => (
          <div
            key={r.id}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden shrink-0"
          >
            <MiniRouteMap
              start={r.center}
              destination={r.center}
              geometry={approximateLoopGeometry(r.center, r.approxDistanceKm ?? DEFAULT_PREVIEW_KM)}
            />
            <div className="p-2 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-xs text-zinc-500">
                  {LANDSCAPE_EMOJI[r.landscapeType]} {LANDSCAPE_LABELS[r.landscapeType]}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                {r.province} · {r.startRegionName} ·{" "}
                {r.approxDistanceKm ? `≈ ${r.approxDistanceKm} km` : "variable Distanz"}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{r.description}</p>
              <button
                type="button"
                onClick={() => handlePick(r)}
                disabled={planningId !== null}
                className="mt-1 rounded-md bg-blue-600 text-white text-xs font-medium py-1.5 disabled:opacity-50"
              >
                {planningId === r.id ? "Route wird geplant…" : "Diese Route planen"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
