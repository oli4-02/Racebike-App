"use client";

import { useTranslations } from "next-intl";
import PrioritySliders from "./PrioritySliders";
import type { OneWaySubMode } from "./OneWayTargetPicker";
import type { POICategory, Priorities } from "@/lib/types";

export type AppMode = "roundtrip" | "oneway" | "signature";

const POI_CATEGORIES: POICategory[] = ["fuel", "supermarket", "ice_cream", "cafe"];

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
