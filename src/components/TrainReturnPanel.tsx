"use client";

import { useEffect, useState } from "react";
import { fetchTrainReturn } from "@/lib/apiClient";
import type { LatLon, TrainInfo } from "@/lib/types";

export default function TrainReturnPanel({
  home,
  dest,
  date,
  title = "Zugrückfahrt",
  preloaded,
}: {
  home: LatLon;
  dest: LatLon;
  date: string;
  title?: string;
  /** Skip the internal fetch and render this instead (e.g. already fetched as part of a scenic-route plan). */
  preloaded?: TrainInfo;
}) {
  const [fetchedInfo, setFetchedInfo] = useState<TrainInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const info = preloaded ?? fetchedInfo;

  useEffect(() => {
    if (preloaded) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchTrainReturn({
          home,
          dest,
          dateTime: `${date}T15:00:00`,
        });
        if (!cancelled) setFetchedInfo(r);
      } catch (e) {
        if (!cancelled) {
          setFetchedInfo({
            configured: true,
            error: e instanceof Error ? e.message : "Fehler",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [home, dest, date, preloaded]);

  return (
    <div className="rounded-md border border-zinc-300 dark:border-zinc-700 p-3 text-sm">
      <h3 className="font-medium mb-2">{title}</h3>
      {loading && <p className="text-zinc-500 text-xs">Lade NS-Verbindungen…</p>}
      {info && !info.configured && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {info.message}
        </p>
      )}
      {info && info.configured && "error" in info && (
        <p className="text-xs text-red-600">{info.error}</p>
      )}
      {info && info.configured && "trips" in info && (
        <div className="flex flex-col gap-2 text-xs">
          <p>
            {info.fromStation.name} → {info.toStation.name}
          </p>
          <p className="text-zinc-500">
            OV-fiets verfügbar: {info.ovFiets.rentalBikesAvailable ?? "unbekannt"}
          </p>
          <ul className="flex flex-col gap-1">
            {info.trips.map((t, i) => (
              <li key={i}>
                {new Date(t.departureTime).toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                →{" "}
                {new Date(t.arrivalTime).toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                ({t.transfers} Umstieg{t.transfers === 1 ? "" : "e"})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
