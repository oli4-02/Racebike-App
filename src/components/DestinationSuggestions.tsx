"use client";

import dynamic from "next/dynamic";
import type { DestinationSuggestion, LatLon } from "@/lib/types";

const MiniRouteMap = dynamic(() => import("./MiniRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-28 w-full rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
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
  if (loading) {
    return <p className="text-xs text-zinc-500">Suche Zielvorschläge…</p>;
  }
  if (suggestions.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        Keine Zielvorschläge in dieser Distanz gefunden. Distanz anpassen oder
        Ziel manuell eingeben.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <div
          key={s.name}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden"
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
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.reason}</p>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="mt-1 rounded-md bg-blue-600 text-white text-xs font-medium py-1.5"
            >
              Diese Route planen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
