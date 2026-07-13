"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import RangeSlider from "@/components/ui/RangeSlider";
import Select from "@/components/ui/Select";
import Slider from "@/components/ui/Slider";
import Toggle from "@/components/ui/Toggle";
import type { POICategory, Priorities, StopRequest } from "@/lib/types";

const POI_CATEGORIES: POICategory[] = ["fuel", "supermarket", "ice_cream", "cafe"];
const STOP_CATEGORIES: POICategory[] = ["cafe", "ice_cream", "supermarket", "fuel"];
const MAX_STOPS = 3;

// The 4 tunable priority dimensions exposed as presets/sliders. `poiDensity`
// isn't a dial here anymore -- planning an actual stop (see StopsPlanner
// below) is a much more direct way to get "pass by a café" than nudging an
// abstract density weight.
const PRESET_KEYS: (keyof Priorities)[] = ["fewTrafficLights", "nature", "shortestTime", "tailwind"];

type Preset = { id: string; values: Partial<Priorities> };

const PRESETS: Preset[] = [
  {
    id: "quietNature",
    values: { fewTrafficLights: 0.9, nature: 0.9, shortestTime: 0.1, tailwind: 0.5 },
  },
  {
    id: "fastDirect",
    values: { fewTrafficLights: 0.2, nature: 0.1, shortestTime: 1, tailwind: 0.5 },
  },
  {
    id: "cafeTour",
    values: { fewTrafficLights: 0.6, nature: 0.6, shortestTime: 0.2, tailwind: 0.4 },
  },
  {
    id: "maxTailwind",
    values: { fewTrafficLights: 0.3, nature: 0.3, shortestTime: 0.3, tailwind: 1 },
  },
];

function isActivePreset(preset: Preset, priorities: Priorities): boolean {
  return PRESET_KEYS.every((key) => priorities[key] === preset.values[key]);
}

function newStopRequest(category: POICategory): StopRequest {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category,
    rangeStartPct: 40,
    rangeEndPct: 60,
  };
}

export default function PreferencesStep({
  priorities,
  setPriorities,
  avgSpeedKmh,
  setAvgSpeedKmh,
  poiCategories,
  setPoiCategories,
  stopRequests,
  setStopRequests,
  avoidMainRoads,
  setAvoidMainRoads,
}: {
  priorities: Priorities;
  setPriorities: (p: Priorities) => void;
  avgSpeedKmh: number;
  setAvgSpeedKmh: (v: number) => void;
  poiCategories: POICategory[];
  setPoiCategories: (v: POICategory[]) => void;
  stopRequests: StopRequest[];
  setStopRequests: (v: StopRequest[]) => void;
  avoidMainRoads: boolean;
  setAvoidMainRoads: (v: boolean) => void;
}) {
  const t = useTranslations("planner.form");
  const tPriorities = useTranslations("planner.priorities");
  const [fineTuneOpen, setFineTuneOpen] = useState(false);

  const poiLabels: Record<POICategory, string> = {
    fuel: t("poiFuel"),
    supermarket: t("poiSupermarket"),
    ice_cream: t("poiIceCream"),
    cafe: t("poiCafe"),
  };

  function togglePoi(cat: POICategory) {
    setPoiCategories(
      poiCategories.includes(cat)
        ? poiCategories.filter((c) => c !== cat)
        : [...poiCategories, cat]
    );
  }

  function applyPreset(preset: Preset) {
    setPriorities({ ...priorities, ...preset.values });
  }

  function addStop() {
    if (stopRequests.length >= MAX_STOPS) return;
    setStopRequests([...stopRequests, newStopRequest("cafe")]);
  }

  function updateStop(id: string, patch: Partial<StopRequest>) {
    setStopRequests(stopRequests.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStop(id: string) {
    setStopRequests(stopRequests.filter((s) => s.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="mb-2 block text-sm font-medium">{tPriorities("title")}</span>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => {
            const active = isActivePreset(preset, priorities);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? "border-meewind-accent bg-meewind-accent/15"
                    : "border-meewind-border hover:bg-meewind-bg-raised"
                }`}
              >
                <span className="text-sm font-semibold">{tPriorities(`presets.${preset.id}.title`)}</span>
                <span className="text-xs text-meewind-fg-muted">
                  {tPriorities(`presets.${preset.id}.subtitle`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setFineTuneOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium text-meewind-fg-muted"
        >
          <span>{tPriorities("fineTune")}</span>
          <span className={`transition-transform ${fineTuneOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {fineTuneOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {PRESET_KEYS.map((key) => (
              <Slider
                key={key}
                value={Math.round(priorities[key] * 100)}
                min={0}
                max={100}
                step={5}
                onChange={(v) => setPriorities({ ...priorities, [key]: v / 100 })}
                label={tPriorities(key)}
                valueLabel={`${Math.round(priorities[key] * 100)}%`}
              />
            ))}
          </div>
        )}
      </div>

      <Toggle
        checked={avoidMainRoads}
        onChange={setAvoidMainRoads}
        label={t("avoidMainRoads.label")}
        hint={t("avoidMainRoads.hint")}
      />

      <Slider
        value={avgSpeedKmh}
        min={15}
        max={40}
        step={1}
        onChange={setAvgSpeedKmh}
        label={t("avgSpeed")}
        valueLabel={`${avgSpeedKmh} km/h`}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-meewind-border p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t("stops.title")}</span>
          <span className="text-xs text-meewind-fg-muted">{stopRequests.length}/{MAX_STOPS}</span>
        </div>
        <p className="text-xs text-meewind-fg-muted">{t("stops.hint")}</p>

        {stopRequests.map((stop, i) => (
          <div key={stop.id} className="flex flex-col gap-2 rounded-md border border-meewind-border p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-meewind-fg-muted">
                {t("stops.stopLabel", { n: i + 1 })}
              </span>
              <div className="flex-1">
                <Select
                  value={stop.category}
                  onChange={(v) => updateStop(stop.id, { category: v as POICategory })}
                  options={STOP_CATEGORIES.map((cat) => ({ value: cat, label: poiLabels[cat] }))}
                />
              </div>
              <button
                type="button"
                onClick={() => removeStop(stop.id)}
                aria-label={t("stops.remove")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-meewind-border text-meewind-fg-muted"
              >
                ✕
              </button>
            </div>
            <RangeSlider
              min={0}
              max={100}
              step={5}
              valueMin={stop.rangeStartPct}
              valueMax={stop.rangeEndPct}
              onChange={(lo, hi) => updateStop(stop.id, { rangeStartPct: lo, rangeEndPct: hi })}
              label={t("stops.rangeLabel")}
              formatValue={(v) => `${v}%`}
            />
          </div>
        ))}

        {stopRequests.length < MAX_STOPS && (
          <button
            type="button"
            onClick={addStop}
            className="rounded-md border border-dashed border-meewind-border py-2 text-xs font-medium text-meewind-fg-muted hover:text-meewind-fg"
          >
            {t("stops.add")}
          </button>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">{t("poiTitle")}</span>
        <div className="flex flex-wrap gap-2">
          {POI_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                poiCategories.includes(cat)
                  ? "border-meewind-accent bg-meewind-accent text-meewind-accent-fg"
                  : "border-meewind-border"
              }`}
              onClick={() => togglePoi(cat)}
            >
              {poiLabels[cat]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
