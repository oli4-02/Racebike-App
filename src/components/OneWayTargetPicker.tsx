"use client";

import { useState } from "react";
import AddressSearch from "./AddressSearch";
import DestinationSuggestions from "./DestinationSuggestions";
import { fetchDestinationSuggestions } from "@/lib/apiClient";
import type { DestinationSuggestion, LatLon, Priorities } from "@/lib/types";

type SubMode = "address" | "suggestions";

export default function OneWayTargetPicker({
  start,
  distanceKm,
  date,
  priorities,
  destination,
  destinationLabel,
  onSelectDestination,
}: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities: Priorities;
  destination: LatLon | null;
  destinationLabel: string | null;
  onSelectDestination: (p: LatLon, label: string) => void;
}) {
  const [subMode, setSubMode] = useState<SubMode>("address");
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    setSuggestError(null);
    setHasSearched(true);
    try {
      const s = await fetchDestinationSuggestions({
        start,
        distanceKm,
        date,
        priorities,
      });
      setSuggestions(s);
    } catch (e) {
      setSuggestError(
        e instanceof Error ? e.message : "Fehler beim Laden der Vorschläge."
      );
    } finally {
      setLoadingSuggestions(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-300 dark:border-zinc-700 p-3">
      <div className="flex rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700 text-xs">
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "address" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
          onClick={() => setSubMode("address")}
        >
          Ziel eingeben
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "suggestions" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
          onClick={() => setSubMode("suggestions")}
        >
          Ziel offen / Vorschläge
        </button>
      </div>

      {subMode === "address" && (
        <AddressSearch onSelect={onSelectDestination} label="Zieladresse" />
      )}

      {subMode === "suggestions" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={loadSuggestions}
            disabled={loadingSuggestions}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 py-2 text-xs font-medium disabled:opacity-50"
          >
            {loadingSuggestions ? "Suche…" : "Vorschläge für diese Distanz suchen"}
          </button>
          {suggestError && (
            <p className="text-xs text-red-600 whitespace-pre-wrap break-words">
              {suggestError}
            </p>
          )}
          {!suggestError && hasSearched && (
            <DestinationSuggestions
              start={start}
              suggestions={suggestions}
              loading={loadingSuggestions}
              onSelect={(s) => onSelectDestination({ lat: s.lat, lon: s.lon }, s.name)}
            />
          )}
        </div>
      )}

      {destination && (
        <p className="text-xs text-zinc-500">
          Ziel: {destinationLabel ?? `${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}`}
        </p>
      )}
    </div>
  );
}
