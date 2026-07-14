"use client";

import { useLocale, useTranslations } from "next-intl";
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
  avgSpeedKmh,
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
  avgSpeedKmh: number;
  destination: LatLon | null;
  destinationLabel: string | null;
  onSelectDestination: (p: LatLon, label: string) => void;
  onScenicRoute: (result: ScenicRoutePlan) => void;
  onSubModeChange?: (m: OneWaySubMode) => void;
}) {
  const t = useTranslations("planner.oneWay");
  const locale = useLocale();
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
        locale,
      });
      setSuggestions(s);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : t("suggestError"));
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function selectSubMode(m: OneWaySubMode) {
    setSubMode(m);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-meewind-border p-3">
      <div className="flex rounded-md overflow-hidden border border-meewind-border text-xs">
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "address" ? "bg-meewind-accent text-meewind-accent-fg" : "bg-meewind-bg-raised"}`}
          onClick={() => selectSubMode("address")}
        >
          {t("tabAddress")}
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "suggestions" ? "bg-meewind-accent text-meewind-accent-fg" : "bg-meewind-bg-raised"}`}
          onClick={() => selectSubMode("suggestions")}
        >
          {t("tabSuggestions")}
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 ${subMode === "scenic" ? "bg-meewind-accent text-meewind-accent-fg" : "bg-meewind-bg-raised"}`}
          onClick={() => selectSubMode("scenic")}
        >
          {t("tabScenic")}
        </button>
      </div>

      {subMode === "address" && <AddressSearch onSelect={onSelectDestination} />}

      {subMode === "suggestions" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={loadSuggestions}
            disabled={loadingSuggestions}
            className="rounded-md border border-meewind-border py-2 text-xs font-medium disabled:opacity-50"
          >
            {loadingSuggestions ? t("searching") : t("searchButton")}
          </button>
          {suggestError && (
            <p className="text-xs text-red-400 whitespace-pre-wrap break-words">
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
          avgSpeedKmh={avgSpeedKmh}
          onPlanned={onScenicRoute}
        />
      )}

      {subMode !== "scenic" && destination && (
        <p className="text-xs text-meewind-fg-muted">
          {t("destinationLabel", {
            value: destinationLabel ?? `${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}`,
          })}
        </p>
      )}
    </div>
  );
}
