"use client";

import { useTranslations } from "next-intl";
import PrioritySliders from "./PrioritySliders";
import type { OneWaySubMode } from "./OneWayTargetPicker";
import type { POICategory, Priorities } from "@/lib/types";

export type AppMode = "roundtrip" | "oneway" | "signature";

const POI_CATEGORIES: POICategory[] = ["fuel", "supermarket", "ice_cream", "cafe"];
// Compass bearings for the roundtrip "direction" picker; null means "any" (the
// original all-around loop shape).
const DIRECTION_OPTIONS: { value: number | null; key: string }[] = [
  { value: null, key: "any" },
  { value: 0, key: "n" },
  { value: 45, key: "ne" },
  { value: 90, key: "e" },
  { value: 135, key: "se" },
  { value: 180, key: "s" },
  { value: 225, key: "sw" },
  { value: 270, key: "w" },
  { value: 315, key: "nw" },
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
  direction: number | null;
  setDirection: (v: number | null) => void;
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
    direction,
    setDirection,
    onSubmit,
    loading,
    canSubmit,
    submitHint,
    oneWaySubMode,
  } = props;

  const t = useTranslations("planner.form");
  const isScenicMode = appMode === "oneway" && oneWaySubMode === "scenic";
  const isSignatureMode = appMode === "signature";
  const hidesSubmit = isScenicMode || isSignatureMode;

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="block text-sm font-medium mb-1">{t("tourType")}</span>
        <div className="flex rounded-md overflow-hidden border border-meewind-border text-sm">
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${appMode === "roundtrip" ? "bg-meewind-accent text-meewind-accent-fg" : "bg-meewind-bg-raised"}`}
            onClick={() => setAppMode("roundtrip")}
          >
            {t("modeRoundtrip")}
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${appMode === "oneway" ? "bg-meewind-accent text-meewind-accent-fg" : "bg-meewind-bg-raised"}`}
            onClick={() => setAppMode("oneway")}
          >
            {t("modeOneway")}
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${appMode === "signature" ? "bg-meewind-accent text-meewind-accent-fg" : "bg-meewind-bg-raised"}`}
            onClick={() => setAppMode("signature")}
          >
            {t("modeSignature")}
          </button>
        </div>
      </div>

      <div>
        <label className="flex justify-between text-sm font-medium mb-1">
          <span>
            {appMode === "roundtrip"
              ? t("distanceRoundtrip")
              : isSignatureMode
                ? t("distanceSignature")
                : isScenicMode
                  ? t("distanceScenic")
                  : t("distanceOneway")}
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

      {appMode === "roundtrip" && (
        <div>
          <label className="block text-sm font-medium mb-1">{t("direction")}</label>
          <select
            value={direction === null ? "any" : String(direction)}
            onChange={(e) => setDirection(e.target.value === "any" ? null : Number(e.target.value))}
            className="w-full rounded-md border border-meewind-border bg-meewind-bg-raised px-3 py-2 text-sm"
          >
            {DIRECTION_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.value === null ? "any" : opt.value}>
                {t(`directions.${opt.key}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-meewind-fg-muted">{t("directionHint")}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">{t("date")}</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-meewind-border bg-meewind-bg-raised px-3 py-2 text-sm text-meewind-fg [color-scheme:dark]"
        />
      </div>

      <PrioritySliders priorities={priorities} setPriorities={setPriorities} />

      <div>
        <span className="block text-sm font-medium mb-1">{t("poiTitle")}</span>
        <div className="flex flex-wrap gap-2">
          {POI_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                poiCategories.includes(cat)
                  ? "bg-meewind-accent text-meewind-accent-fg border-meewind-accent"
                  : "border-meewind-border"
              }`}
              onClick={() => togglePoi(cat)}
            >
              {poiLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {hidesSubmit ? (
        <p className="text-xs text-meewind-fg-muted">
          {isSignatureMode ? t("hideSubmitSignature") : t("hideSubmitScenic")}
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={onSubmit}
            className="rounded-md bg-meewind-accent text-meewind-accent-fg py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("submitLoading") : t("submit")}
          </button>
          {!canSubmit && submitHint && (
            <p className="text-xs text-meewind-fg-muted">{submitHint}</p>
          )}
        </>
      )}
    </div>
  );
}
