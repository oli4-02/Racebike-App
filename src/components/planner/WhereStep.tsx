"use client";

import { useTranslations } from "next-intl";
import AddressSearch from "@/components/AddressSearch";
import OneWayTargetPicker, { type OneWaySubMode } from "@/components/OneWayTargetPicker";
import PreferencesGateHint from "@/components/planner/PreferencesGateHint";
import RouteAlternativesPicker from "@/components/RouteAlternativesPicker";
import SignatureRoutePicker from "@/components/SignatureRoutePicker";
import DateField from "@/components/ui/DateField";
import Select from "@/components/ui/Select";
import Slider from "@/components/ui/Slider";
import type {
  AppMode,
  LatLon,
  PlannedRoute,
  POICategory,
  Priorities,
  ScenicRoutePlan,
  SignatureRoutePlan,
} from "@/lib/types";

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

export default function WhereStep({
  appMode,
  setAppMode,
  distanceKm,
  setDistanceKm,
  direction,
  setDirection,
  date,
  setDate,
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
  poiCategories,
  avoidMainRoads,
  onRouteAlternative,
  onSignatureRoute,
  onDistanceKmChange,
  hasVisitedPreferences,
  onGoToPreferences,
}: {
  appMode: AppMode;
  setAppMode: (m: AppMode) => void;
  distanceKm: number;
  setDistanceKm: (v: number) => void;
  direction: number | null;
  setDirection: (v: number | null) => void;
  date: string;
  setDate: (v: string) => void;
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
  poiCategories: POICategory[];
  avoidMainRoads: boolean;
  onRouteAlternative: (route: PlannedRoute) => void;
  onSignatureRoute: (result: SignatureRoutePlan) => void;
  onDistanceKmChange: (km: number) => void;
  hasVisitedPreferences: boolean;
  onGoToPreferences: () => void;
}) {
  const t = useTranslations("planner.form");
  const isScenicMode = appMode === "oneway" && oneWaySubMode === "scenic";
  const isSignatureMode = appMode === "signature";

  const directionOptions = DIRECTION_OPTIONS.map((opt) => ({
    value: opt.value === null ? "any" : String(opt.value),
    label: t(`directions.${opt.key}`),
  }));

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

      <Slider
        value={distanceKm}
        min={20}
        max={200}
        step={5}
        onChange={setDistanceKm}
        label={
          appMode === "roundtrip"
            ? t("distanceRoundtrip")
            : isSignatureMode
              ? t("distanceSignature")
              : isScenicMode
                ? t("distanceScenic")
                : t("distanceOneway")
        }
        valueLabel={`${distanceKm} km`}
      />

      {appMode === "roundtrip" && (
        <div>
          <Select
            label={t("direction")}
            value={direction === null ? "any" : String(direction)}
            onChange={(v) => setDirection(v === "any" ? null : Number(v))}
            options={directionOptions}
          />
          <p className="mt-1 text-xs text-meewind-fg-muted">{t("directionHint")}</p>
        </div>
      )}

      <DateField label={t("date")} value={date} onChange={setDate} />

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
          hasVisitedPreferences={hasVisitedPreferences}
          onGoToPreferences={onGoToPreferences}
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

      {appMode === "roundtrip" && start && (
        hasVisitedPreferences ? (
          <RouteAlternativesPicker
            start={start}
            distanceKm={distanceKm}
            date={date}
            priorities={priorities}
            direction={direction}
            avgSpeedKmh={avgSpeedKmh}
            poiCategories={poiCategories}
            avoidMainRoads={avoidMainRoads}
            onPlanned={onRouteAlternative}
          />
        ) : (
          <PreferencesGateHint onGoToPreferences={onGoToPreferences} />
        )
      )}
    </div>
  );
}
