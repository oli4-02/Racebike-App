"use client";

import { useEffect, useState } from "react";
import { fetchScenicCorridors, planScenicRoute } from "@/lib/apiClient";
import { LANDSCAPE_EMOJI, LANDSCAPE_LABELS } from "@/lib/scenicCorridors";
import type { LandscapeType, LatLon, Priorities, ScenicCorridor, ScenicRoutePlan } from "@/lib/types";

const LANDSCAPE_TYPES = Object.keys(LANDSCAPE_LABELS) as LandscapeType[];

export default function ScenicCorridorPicker({
  start,
  distanceKm,
  date,
  priorities,
  onPlanned,
}: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities: Priorities;
  onPlanned: (result: ScenicRoutePlan) => void;
}) {
  const [corridors, setCorridors] = useState<ScenicCorridor[]>([]);
  const [loadingCorridors, setLoadingCorridors] = useState(true);
  const [filter, setFilter] = useState<LandscapeType | null>(null);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchScenicCorridors()
      .then((c) => !cancelled && setCorridors(c))
      .catch(() => !cancelled && setError("Korridor-Liste konnte nicht geladen werden."))
      .finally(() => !cancelled && setLoadingCorridors(false));
    return () => {
      cancelled = true;
    };
  }, []);

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
      });
      onPlanned(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Landschafts-Route fehlgeschlagen.");
    } finally {
      setPlanningId(null);
    }
  }

  const visible = filter ? corridors.filter((c) => c.landscapeType === filter) : corridors;

  return (
    <div className="flex flex-col gap-2">
      {loadingCorridors && <p className="text-xs text-zinc-500">Lade Korridore…</p>}

      {!loadingCorridors && (
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

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {visible.map((c) => (
          <div
            key={c.id}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 p-2 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-zinc-500">
                {LANDSCAPE_EMOJI[c.landscapeType]} {LANDSCAPE_LABELS[c.landscapeType]}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{c.description}</p>
            <p className="text-xs text-zinc-500">Einstieg: {c.entryStationName}</p>
            <button
              type="button"
              onClick={() => handlePick(c)}
              disabled={planningId !== null}
              className="mt-1 rounded-md bg-blue-600 text-white text-xs font-medium py-1.5 disabled:opacity-50"
            >
              {planningId === c.id ? "Route wird geplant…" : "Diese Route planen"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
