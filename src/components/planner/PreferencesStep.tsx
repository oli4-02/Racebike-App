"use client";

import { useTranslations } from "next-intl";
import PriorityRadar from "@/components/PriorityRadar";
import Slider from "@/components/ui/Slider";
import type { POICategory, Priorities } from "@/lib/types";

const POI_CATEGORIES: POICategory[] = ["fuel", "supermarket", "ice_cream", "cafe"];

export default function PreferencesStep({
  priorities,
  setPriorities,
  avgSpeedKmh,
  setAvgSpeedKmh,
  poiCategories,
  setPoiCategories,
}: {
  priorities: Priorities;
  setPriorities: (p: Priorities) => void;
  avgSpeedKmh: number;
  setAvgSpeedKmh: (v: number) => void;
  poiCategories: POICategory[];
  setPoiCategories: (v: POICategory[]) => void;
}) {
  const t = useTranslations("planner.form");

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
    <div className="flex flex-col gap-5">
      <PriorityRadar priorities={priorities} setPriorities={setPriorities} />

      <Slider
        value={avgSpeedKmh}
        min={15}
        max={40}
        step={1}
        onChange={setAvgSpeedKmh}
        label={t("avgSpeed")}
        valueLabel={`${avgSpeedKmh} km/h`}
      />

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
