"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fetchScenicCorridors, planScenicRoute } from "@/lib/apiClient";
import { LANDSCAPE_EMOJI, useLandscapeLabels } from "@/lib/scenicCorridors";
import type { LandscapeType, LatLon, Priorities, ScenicCorridor, ScenicRoutePlan } from "@/lib/types";

export default function ScenicCorridorPicker({
  start,
  distanceKm,
  date,
  priorities,
  avgSpeedKmh,
  onPlanned,
}: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities: Priorities;
  avgSpeedKmh: number;
  onPlanned: (result: ScenicRoutePlan) => void;
}) {
  const t = useTranslations("planner.scenic");
  const locale = useLocale();
  const landscapeLabels = useLandscapeLabels();
  const landscapeTypes = Object.keys(landscapeLabels) as LandscapeType[];
  const [corridors, setCorridors] = useState<ScenicCorridor[]>([]);
  const [loadingCorridors, setLoadingCorridors] = useState(true);
  const [filter, setFilter] = useState<LandscapeType | null>(null);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchScenicCorridors(locale)
      .then((c) => !cancelled && setCorridors(c))
      .catch(() => !cancelled && setError(t("errorLoad")))
      .finally(() => !cancelled && setLoadingCorridors(false));
    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  async function handlePick(corridor: ScenicCorridor) {
    setPlanningId(corridor.id);
    setError(null);
    try {
      const result = await planScenicRoute({
        corridorId: corridor.id,
        start,
        distanceKm,
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

  const visible = filter ? corridors.filter((c) => c.landscapeType === filter) : corridors;

  return (
    <div className="flex flex-col gap-2">
      {loadingCorridors && <p className="text-xs text-meewind-fg-muted">{t("loading")}</p>}

      {!loadingCorridors && (
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

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {visible.map((c) => (
          <div
            key={c.id}
            className="rounded-md border border-meewind-border p-2 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-meewind-fg-muted">
                {LANDSCAPE_EMOJI[c.landscapeType]} {landscapeLabels[c.landscapeType]}
              </span>
            </div>
            <p className="text-xs text-meewind-fg-muted">{c.description}</p>
            <p className="text-xs text-meewind-fg-muted">{t("entry", { station: c.entryStationName })}</p>
            <button
              type="button"
              onClick={() => handlePick(c)}
              disabled={planningId !== null}
              className="mt-1 rounded-md bg-meewind-accent text-meewind-accent-fg text-xs font-medium py-1.5 disabled:opacity-50"
            >
              {planningId === c.id ? t("planning") : t("plan")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
