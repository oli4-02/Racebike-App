"use client";

import { useEffect, useState } from "react";
import AddressSearch from "./AddressSearch";
import DestinationSuggestions from "./DestinationSuggestions";
import ScenicCorridorPicker from "./ScenicCorridorPicker";
import { fetchDestinationSuggestions } from "@/lib/apiClient";
import type { DestinationSuggestion, LatLon, Priorities, ScenicRoutePlan } from "@/lib/types";

export type OneWaySubMode = "address" | "suggestions" | "scenic";

export default function OneWayTargetPicker({
  start,
  distanceKm,
  date,
  priorities,
  destination,
  destinationLabel,
  onSelectDestination,
  onScenicRoute,
  onSubModeChange,
}: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities: Priorities;
  destination: LatLon | null;
  destinationLabel: string | null;
  onSelectDestination: (p: LatLon, label: string) => void;
  onScenicRoute: (result: ScenicRoutePlan) => void;
  onSubModeChange?: (m: OneWaySubMode) => void;
}) {
  const [subMode, setSubMode] = useState<OneWaySubMode>("address");
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    onSubModeChange?.(subMode);
  }, [subMode, onSubModeChange]);

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

  function selectSubMode(m: OneWaySubMode) {
    setSubMode(m);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-300 dark:border-zinc-700 p-3">
      <div className="flex rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700 text-xs">
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "address" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
          onClick={() => selectSubMode("address")}
        >
          Ziel eingeben
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "suggestions" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
          onClick={() => selectSubMode("suggestions")}
        >
          Ziel offen / Vorschläge
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "scenic" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
          onClick={() => selectSubMode("scenic")}
        >
          Landschafts-Route
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

      {subMode === "scenic" && (
        <ScenicCorridorPicker
          start={start}
          distanceKm={distanceKm}
          date={date}
          priorities={priorities}
          onPlanned={onScenicRoute}
        />
      )}

      {subMode !== "scenic" && destination && (
        <p className="text-xs text-zinc-500">
          Ziel: {destinationLabel ?? `${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}`}
        </p>
      )}
    </div>
  );
}
