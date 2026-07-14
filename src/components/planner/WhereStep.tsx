"use client";

import { useTranslations } from "next-intl";
import AddressSearch from "@/components/AddressSearch";
import OneWayTargetPicker, { type OneWaySubMode } from "@/components/OneWayTargetPicker";
import SignatureRoutePicker from "@/components/SignatureRoutePicker";
import Slider from "@/components/ui/Slider";
import type {
  AppMode,
  LatLon,
  Priorities,
  ScenicRoutePlan,
  SignatureRoutePlan,
} from "@/lib/types";

/**
 * The essentials: everything a rider must fill in before getting a first
 * route. For the default roundtrip mode that's just start + distance --
 * direction, date and all other tuning live in the collapsed "Anpassen"
 * section instead (see CustomizeSection), since they already have sensible
 * defaults. One-way and signature modes unavoidably need a bit more (a
 * destination or a picked tour) since that's the whole point of choosing
 * that mode, not an optional detail. Pressing the main "Route planen"
 * footer button (see page.tsx) is what actually computes a roundtrip --
 * including its 5 variants -- there's no separate pre-submit entry point
 * for that here.
 */
export default function WhereStep({
  appMode,
  setAppMode,
  distanceKm,
  setDistanceKm,
  date,
  onSetStart,
  start,
  destination,
  destinationLabel,
  onSelectDestination,
  onScenicRoute,
  onSubModeChange,
  oneWaySubMode,
  priorities,
  avgSpeedKmh,
  onSignatureRoute,
  onDistanceKmChange,
}: {
  appMode: AppMode;
  setAppMode: (m: AppMode) => void;
  distanceKm: number;
  setDistanceKm: (v: number) => void;
  date: string;
  onSetStart: (p: LatLon) => void;
  start: LatLon | null;
  destination: LatLon | null;
  destinationLabel: string | null;
  onSelectDestination: (p: LatLon, label: string) => void;
  onScenicRoute: (result: ScenicRoutePlan) => void;
  onSubModeChange: (m: OneWaySubMode) => void;
  oneWaySubMode: OneWaySubMode;
  priorities: Priorities;
  avgSpeedKmh: number;
  onSignatureRoute: (result: SignatureRoutePlan) => void;
  onDistanceKmChange: (km: number) => void;
}) {
  const t = useTranslations("planner.form");
  const isScenicMode = appMode === "oneway" && oneWaySubMode === "scenic";
  const isSignatureMode = appMode === "signature";

  return (
    <div className="flex flex-col gap-4">
      <AddressSearch onSelect={onSetStart} />

      <div>
        <span className="mb-1 block text-sm font-medium">{t("tourType")}</span>
        <div className="flex overflow-hidden rounded-lg border border-meewind-border text-sm">
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

      {!isSignatureMode && (
        <Slider
          value={distanceKm}
          min={20}
          max={200}
          step={5}
          onChange={setDistanceKm}
          label={
            appMode === "roundtrip"
              ? t("distanceRoundtrip")
              : isScenicMode
                ? t("distanceScenic")
                : t("distanceOneway")
          }
          valueLabel={`${distanceKm} km`}
        />
      )}

      {appMode === "oneway" && start && (
        <OneWayTargetPicker
          start={start}
          distanceKm={distanceKm}
          date={date}
          priorities={priorities}
          avgSpeedKmh={avgSpeedKmh}
          destination={destination}
          destinationLabel={destinationLabel}
          onSelectDestination={onSelectDestination}
          onScenicRoute={onScenicRoute}
          onSubModeChange={onSubModeChange}
        />
      )}

      {appMode === "signature" && start && (
        <SignatureRoutePicker
          start={start}
          distanceKm={distanceKm}
          date={date}
          priorities={priorities}
          avgSpeedKmh={avgSpeedKmh}
          onDistanceKmChange={onDistanceKmChange}
          onPlanned={onSignatureRoute}
        />
      )}
    </div>
  );
}
