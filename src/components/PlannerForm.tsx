"use client";

import PrioritySliders from "./PrioritySliders";
import type { OneWaySubMode } from "./OneWayTargetPicker";
import type { POICategory, Priorities } from "@/lib/types";

export type AppMode = "roundtrip" | "oneway" | "signature";

const POI_OPTIONS: { key: POICategory; label: string }[] = [
  { key: "fuel", label: "⛽ Tankstelle" },
  { key: "supermarket", label: "🛒 Supermarkt" },
  { key: "ice_cream", label: "🍦 Eisdiele" },
  { key: "cafe", label: "☕ Café" },
];

export default function PlannerForm(props: {
  appMode: AppMode;
  setAppMode: (m: AppMode) => void;
  distanceKm: number;
  setDistanceKm: (v: number) => void;
  date: string;
  setDate: (v: string) => void;
  priorities: Priorities;
  setPriorities: (p: Priorities) => void;
  poiCategories: POICategory[];
  setPoiCategories: (v: POICategory[]) => void;
  onSubmit: () => void;
  loading: boolean;
  canSubmit: boolean;
  submitHint: string | null;
  oneWaySubMode?: OneWaySubMode;
}) {
  const {
    appMode,
    setAppMode,
    distanceKm,
    setDistanceKm,
    date,
    setDate,
    priorities,
    setPriorities,
    poiCategories,
    setPoiCategories,
    onSubmit,
    loading,
    canSubmit,
    submitHint,
    oneWaySubMode,
  } = props;

  const isScenicMode = appMode === "oneway" && oneWaySubMode === "scenic";
  const isSignatureMode = appMode === "signature";
  const hidesSubmit = isScenicMode || isSignatureMode;

  function togglePoi(cat: POICategory) {
    setPoiCategories(
      poiCategories.includes(cat)
        ? poiCategories.filter((c) => c !== cat)
        : [...poiCategories, cat]
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="block text-sm font-medium mb-1">Tourtyp</span>
        <div className="flex rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700 text-sm">
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${appMode === "roundtrip" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
            onClick={() => setAppMode("roundtrip")}
          >
            Rundtour
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${appMode === "oneway" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
            onClick={() => setAppMode("oneway")}
          >
            One-Way + Zug
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${appMode === "signature" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900"}`}
            onClick={() => setAppMode("signature")}
          >
            Signature-Route
          </button>
        </div>
      </div>

      <div>
        <label className="flex justify-between text-sm font-medium mb-1">
          <span>
            {appMode === "roundtrip"
              ? "Distanz"
              : isSignatureMode
                ? "Ziel-Distanz (wird beim Auswählen ggf. angepasst)"
                : isScenicMode
                  ? "Gewünschte Fahrlänge im Korridor"
                  : "Such-Distanz für Ziel"}
          </span>
          <span>{distanceKm} km</span>
        </label>
        <input
          type="range"
          min={20}
          max={200}
          step={5}
          value={distanceKm}
          onChange={(e) => setDistanceKm(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Fahrtdatum</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>

      <PrioritySliders priorities={priorities} setPriorities={setPriorities} />

      <div>
        <span className="block text-sm font-medium mb-1">
          Points of Interest
        </span>
        <div className="flex flex-wrap gap-2">
          {POI_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                poiCategories.includes(opt.key)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
              onClick={() => togglePoi(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {hidesSubmit ? (
        <p className="text-xs text-zinc-500">
          {isSignatureMode
            ? "Oben eine Signature-Route auswählen, um die Route direkt zu planen."
            : "Oben einen Korridor auswählen, um die Route direkt zu planen."}
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={onSubmit}
            className="rounded-md bg-blue-600 text-white py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Route wird geplant…" : "Route planen"}
          </button>
          {!canSubmit && submitHint && (
            <p className="text-xs text-zinc-500">{submitHint}</p>
          )}
        </>
      )}
    </div>
  );
}
