"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import PlannerPanel, { type PlannerTabKey } from "@/components/PlannerPanel";
import PreferencesStep from "@/components/planner/PreferencesStep";
import ResultStep from "@/components/planner/ResultStep";
import WhereStep from "@/components/planner/WhereStep";
import type { OneWaySubMode } from "@/components/OneWayTargetPicker";
import { fetchPois, planRoute } from "@/lib/apiClient";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type {
  AppMode,
  LatLon,
  PlannedRoute,
  POI,
  POICategory,
  Priorities,
  RoadTypeResult,
  RouteMode,
  ScenicRoutePlan,
  SignatureRoutePlan,
  StopRequest,
} from "@/lib/types";
import type { PlanPreview } from "@/components/RouteMap";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-meewind-fg-muted">
      …
    </div>
  ),
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PlannerPage() {
  const t = useTranslations("planner");
  const tMap = useTranslations("planner.map");
  const locale = useLocale();

  const [start, setStart] = useState<LatLon | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("roundtrip");
  const [distanceKm, setDistanceKm] = useState(60);
  const [direction, setDirection] = useState<number | null>(null);
  const [avgSpeedKmh, setAvgSpeedKmh] = useState(27);
  const [date, setDate] = useState(today());
  const [priorities, setPriorities] = useState<Priorities>(DEFAULT_PRIORITIES);
  const [poiCategories, setPoiCategories] = useState<POICategory[]>([
    "fuel",
    "supermarket",
    "ice_cream",
    "cafe",
  ]);
  const [stopRequests, setStopRequests] = useState<StopRequest[]>([]);
  const [avoidMainRoads, setAvoidMainRoads] = useState(false);
  const [destination, setDestination] = useState<LatLon | null>(null);
  const [destinationLabel, setDestinationLabel] = useState<string | null>(null);
  const [oneWaySubMode, setOneWaySubMode] = useState<OneWaySubMode>("address");
  const [scenicPlan, setScenicPlan] = useState<ScenicRoutePlan | null>(null);
  const [signaturePlan, setSignaturePlan] = useState<SignatureRoutePlan | null>(null);

  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roadTypeSegments, setRoadTypeSegments] = useState<RoadTypeResult["segments"]>([]);
  // stopId -> the POI the rider picked for that stop from its candidate list.
  const [selectedStopPoiIds, setSelectedStopPoiIds] = useState<Record<string, number>>({});

  const [activeTab, setActiveTab] = useState<PlannerTabKey>("where");
  const [collapsed, setCollapsed] = useState(false);
  // The 5 roundtrip variants and one-way destination suggestions both rank
  // candidates using `priorities` -- offering them before the rider has even
  // looked at the preferences tab means they'd be scored against whatever
  // defaults happen to be set, only to need redoing once adjusted. Gated
  // behind having visited that tab at least once (not "confirmed" it --
  // just having seen it is enough to make an informed choice or leave the
  // defaults on purpose).
  const [hasVisitedPreferences, setHasVisitedPreferences] = useState(false);

  function handleTabChange(tab: PlannerTabKey) {
    setActiveTab(tab);
    if (tab === "preferences") setHasVisitedPreferences(true);
  }

  // The core planner only knows roundtrip/oneway; "signature" is a UI-level
  // mode that always resolves to a roundtrip plan via its own endpoint.
  const mode: RouteMode = appMode === "oneway" ? "oneway" : "roundtrip";
  const isScenicMode = appMode === "oneway" && oneWaySubMode === "scenic";
  const hidesSubmit = isScenicMode || appMode === "signature";

  const canSubmit =
    appMode !== "signature" && Boolean(start) && (mode === "roundtrip" || Boolean(destination));
  const submitHint = !start
    ? t("form.submitHintNoStart")
    : mode === "oneway" && !destination
      ? t("form.submitHintNoDestination")
      : null;

  async function loadPois(geometry: LatLon[]) {
    // Fetches for both the simple display-toggle categories and whatever
    // categories the configured stops need -- a stop's candidate search
    // must work regardless of whether that category also happens to be
    // toggled on for map markers (the two are intentionally independent).
    const categories = Array.from(
      new Set([...poiCategories, ...stopRequests.map((s) => s.category)])
    );
    if (categories.length === 0) return;
    try {
      const p = await fetchPois(geometry, categories, locale);
      setPois(p);
    } catch {
      // POIs are a nice-to-have; a failed lookup shouldn't block the route.
    }
  }

  async function handleSubmit() {
    if (!start || !canSubmit) return;
    setLoading(true);
    setError(null);
    setPois([]);
    setRoadTypeSegments([]);
    setSelectedStopPoiIds({});
    try {
      const planned = await planRoute(
        {
          start,
          mode,
          distanceKm,
          date,
          priorities,
          destination: mode === "oneway" ? destination! : undefined,
          direction: mode === "roundtrip" ? direction : undefined,
          avgSpeedKmh,
          poiCategories,
          avoidMainRoads,
        },
        locale
      );
      setRoute(planned);
      setActiveTab("result");
      // POIs are a secondary, non-blocking overlay -- don't make the user
      // wait through another Overpass round trip before the route itself
      // (already computed) is shown.
      void loadPois(planned.geometry);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("home.routeError"));
      setRoute(null);
      setActiveTab("result");
    } finally {
      setLoading(false);
    }
  }

  function handleRouteAlternative(planned: PlannedRoute) {
    setError(null);
    setScenicPlan(null);
    setSignaturePlan(null);
    setRoute(planned);
    setPois([]);
    setRoadTypeSegments([]);
    setSelectedStopPoiIds({});
    setActiveTab("result");
    void loadPois(planned.geometry);
  }

  function handleScenicRoute(result: ScenicRoutePlan) {
    setError(null);
    setDestination(null);
    setDestinationLabel(null);
    setSignaturePlan(null);
    setScenicPlan(result);
    setRoute(result.route);
    setPois([]);
    setRoadTypeSegments([]);
    setSelectedStopPoiIds({});
    setActiveTab("result");
    void loadPois(result.route.geometry);
  }

  function handleSignatureRoute(result: SignatureRoutePlan) {
    setError(null);
    setDestination(null);
    setDestinationLabel(null);
    setScenicPlan(null);
    setSignaturePlan(result);
    setRoute(result.route);
    setPois([]);
    setRoadTypeSegments([]);
    setSelectedStopPoiIds({});
    setActiveTab("result");
    void loadPois(result.route.geometry);
  }

  function handleSetAppMode(next: AppMode) {
    setAppMode(next);
    setRoute(null);
    setScenicPlan(null);
    setSignaturePlan(null);
  }

  function handleSetStart(p: LatLon) {
    setStart(p);
    setScenicPlan(null);
    setSignaturePlan(null);
  }

  const mapStart = scenicPlan
    ? scenicPlan.entryStation
    : signaturePlan?.usedStation && signaturePlan.station
      ? signaturePlan.station
      : start;
  const mapDestination = scenicPlan
    ? scenicPlan.exitStation
    : mode === "oneway"
      ? destination
      : null;
  const mapHomeMarker = scenicPlan
    ? start
    : signaturePlan?.usedStation
      ? start
      : null;

  // Rough, purely client-side search-area indicator shown before a route
  // exists, so the map gives feedback the moment a start point is set
  // instead of staying blank until "Route planen" is pressed. Hidden once a
  // route is computed (the real route line speaks for itself) or in
  // signature mode (distance there comes from the picked tour, not the
  // slider).
  const preview: PlanPreview | null =
    start && !route && appMode !== "signature"
      ? { mode, distanceKm, direction: mode === "roundtrip" ? direction : null }
      : null;

  // Map markers only show the categories the rider actually toggled on --
  // POIs fetched purely because a stop needs that category shouldn't leak
  // onto the map as regular markers (stop planning and the display toggles
  // are intentionally independent features). Selected stops are shown
  // separately below with their own distinct marker regardless of the
  // toggle state, since picking a stop is a stronger signal than a display
  // preference.
  const displayPois = pois.filter((p) => poiCategories.includes(p.category));
  const selectedStopPoiIdSet = new Set(Object.values(selectedStopPoiIds));
  const selectedStopPois = pois.filter((p) => selectedStopPoiIdSet.has(p.id));

  const tabs: { key: PlannerTabKey; label: string }[] = [
    { key: "where", label: t("tabs.where") },
    { key: "preferences", label: t("tabs.preferences") },
    { key: "result", label: t("tabs.result") },
  ];

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <RouteMap
          start={mapStart}
          onSetStart={handleSetStart}
          legs={route?.legs ?? []}
          pois={displayPois}
          selectedStopPois={selectedStopPois}
          wind={route?.windInfo ?? null}
          roadTypeSegments={route ? roadTypeSegments : []}
          preview={preview}
          destination={mapDestination}
          homeMarker={mapHomeMarker}
          labels={{
            start: tMap("start"),
            home: tMap("home"),
            destination: tMap("destination"),
          }}
        />
      </div>

      <PlannerPanel
        title={t("header.title")}
        subtitle={t("header.subtitle")}
        backLabel={t("backToLanding")}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        footer={
          !hidesSubmit && (
            <>
              <button
                type="button"
                disabled={!canSubmit || loading}
                onClick={handleSubmit}
                className="w-full rounded-md bg-meewind-accent py-2.5 text-sm font-medium text-meewind-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? t("form.submitLoading") : t("form.submit")}
              </button>
              {!canSubmit && submitHint && (
                <p className="mt-1 text-xs text-meewind-fg-muted">{submitHint}</p>
              )}
            </>
          )
        }
      >
        {activeTab === "where" && (
          <WhereStep
            appMode={appMode}
            setAppMode={handleSetAppMode}
            distanceKm={distanceKm}
            setDistanceKm={setDistanceKm}
            direction={direction}
            setDirection={setDirection}
            date={date}
            setDate={setDate}
            onSetStart={handleSetStart}
            start={start}
            destination={destination}
            destinationLabel={destinationLabel}
            onSelectDestination={(p, label) => {
              setScenicPlan(null);
              setDestination(p);
              setDestinationLabel(label);
            }}
            onScenicRoute={handleScenicRoute}
            onSubModeChange={setOneWaySubMode}
            oneWaySubMode={oneWaySubMode}
            priorities={priorities}
            avgSpeedKmh={avgSpeedKmh}
            poiCategories={poiCategories}
            avoidMainRoads={avoidMainRoads}
            onRouteAlternative={handleRouteAlternative}
            onSignatureRoute={handleSignatureRoute}
            onDistanceKmChange={setDistanceKm}
            hasVisitedPreferences={hasVisitedPreferences}
            onGoToPreferences={() => handleTabChange("preferences")}
          />
        )}

        {activeTab === "preferences" && (
          <PreferencesStep
            priorities={priorities}
            setPriorities={setPriorities}
            avgSpeedKmh={avgSpeedKmh}
            setAvgSpeedKmh={setAvgSpeedKmh}
            poiCategories={poiCategories}
            setPoiCategories={setPoiCategories}
            stopRequests={stopRequests}
            setStopRequests={setStopRequests}
            avoidMainRoads={avoidMainRoads}
            setAvoidMainRoads={setAvoidMainRoads}
          />
        )}

        {activeTab === "result" && (
          <ResultStep
            route={route}
            pois={pois}
            selectedStopPois={selectedStopPois}
            error={error}
            mode={mode}
            start={start}
            date={date}
            destination={destination}
            scenicPlan={scenicPlan}
            signaturePlan={signaturePlan}
            onRoadTypeSegments={setRoadTypeSegments}
            stopRequests={stopRequests}
            selectedStopPoiIds={selectedStopPoiIds}
            onSelectStopPoi={(stopId, poiId) =>
              setSelectedStopPoiIds((prev) => ({ ...prev, [stopId]: poiId }))
            }
          />
        )}
      </PlannerPanel>
    </div>
  );
}
