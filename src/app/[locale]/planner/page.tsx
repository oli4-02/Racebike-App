"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import OneWayTargetPicker, { type OneWaySubMode } from "@/components/OneWayTargetPicker";
import PlannerForm, { type AppMode } from "@/components/PlannerForm";
import RouteAlternativesPicker from "@/components/RouteAlternativesPicker";
import RouteSummary from "@/components/RouteSummary";
import SignatureRoutePicker from "@/components/SignatureRoutePicker";
import TrainReturnPanel from "@/components/TrainReturnPanel";
import { Link } from "@/i18n/navigation";
import { fetchPois, planRoute } from "@/lib/apiClient";
import { LANDSCAPE_EMOJI, useLandscapeLabels } from "@/lib/scenicCorridors";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type {
  LatLon,
  PlannedRoute,
  POI,
  POICategory,
  Priorities,
  RoadTypeResult,
  RouteMode,
  ScenicRoutePlan,
  SignatureRoutePlan,
} from "@/lib/types";

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
  const landscapeLabels = useLandscapeLabels();
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

  // The core planner only knows roundtrip/oneway; "signature" is a UI-level
  // mode that always resolves to a roundtrip plan via its own endpoint.
  const mode: RouteMode = appMode === "oneway" ? "oneway" : "roundtrip";

  const canSubmit =
    appMode !== "signature" && Boolean(start) && (mode === "roundtrip" || Boolean(destination));
  const submitHint = !start
    ? t("form.submitHintNoStart")
    : mode === "oneway" && !destination
      ? t("form.submitHintNoDestination")
      : null;

  async function loadPois(geometry: LatLon[]) {
    if (poiCategories.length === 0) return;
    try {
      const p = await fetchPois(geometry, poiCategories, locale);
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
        },
        locale
      );
      setRoute(planned);
      // POIs are a secondary, non-blocking overlay -- don't make the user
      // wait through another Overpass round trip before the route itself
      // (already computed) is shown.
      void loadPois(planned.geometry);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("home.routeError"));
      setRoute(null);
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

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0">
      <aside className="order-2 md:order-1 flex flex-col gap-4 overflow-y-auto p-4 md:w-96 md:h-screen border-t md:border-t-0 md:border-r border-meewind-border">
        <div>
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xs text-meewind-accent hover:underline">
              {t("backToLanding")}
            </Link>
            <LocaleSwitcher />
          </div>
          <h1 className="meewind-display text-lg mt-1">{t("header.title")}</h1>
          <p className="text-xs text-meewind-fg-muted">{t("header.subtitle")}</p>
        </div>

        <AddressSearch onSelect={handleSetStart} />

        {appMode === "oneway" && start && (
          <OneWayTargetPicker
            start={start}
            distanceKm={distanceKm}
            date={date}
            priorities={priorities}
            avgSpeedKmh={avgSpeedKmh}
            destination={destination}
            destinationLabel={destinationLabel}
            onSelectDestination={(p, label) => {
              setScenicPlan(null);
              setDestination(p);
              setDestinationLabel(label);
            }}
            onScenicRoute={handleScenicRoute}
            onSubModeChange={setOneWaySubMode}
          />
        )}

        {appMode === "roundtrip" && start && (
          <RouteAlternativesPicker
            start={start}
            distanceKm={distanceKm}
            date={date}
            priorities={priorities}
            direction={direction}
            avgSpeedKmh={avgSpeedKmh}
            poiCategories={poiCategories}
            onPlanned={handleRouteAlternative}
          />
        )}

        {appMode === "signature" && start && (
          <SignatureRoutePicker
            start={start}
            distanceKm={distanceKm}
            date={date}
            priorities={priorities}
            avgSpeedKmh={avgSpeedKmh}
            onDistanceKmChange={setDistanceKm}
            onPlanned={handleSignatureRoute}
          />
        )}

        <PlannerForm
          appMode={appMode}
          setAppMode={handleSetAppMode}
          distanceKm={distanceKm}
          setDistanceKm={setDistanceKm}
          date={date}
          setDate={setDate}
          priorities={priorities}
          setPriorities={setPriorities}
          poiCategories={poiCategories}
          setPoiCategories={setPoiCategories}
          direction={direction}
          setDirection={setDirection}
          avgSpeedKmh={avgSpeedKmh}
          setAvgSpeedKmh={setAvgSpeedKmh}
          onSubmit={handleSubmit}
          loading={loading}
          canSubmit={canSubmit}
          submitHint={submitHint}
          oneWaySubMode={appMode === "oneway" ? oneWaySubMode : undefined}
        />

        {error && (
          <div className="rounded-md bg-red-950/40 p-2 text-xs text-red-300 whitespace-pre-wrap break-words">
            {error}
          </div>
        )}

        {scenicPlan && (
          <div className="rounded-md border border-meewind-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{scenicPlan.corridor.name}</span>
              <span className="text-xs text-meewind-fg-muted">
                {LANDSCAPE_EMOJI[scenicPlan.corridor.landscapeType]}{" "}
                {landscapeLabels[scenicPlan.corridor.landscapeType]}
              </span>
            </div>
            <p className="text-xs text-meewind-fg-muted mt-1">
              {scenicPlan.corridor.description}
            </p>
          </div>
        )}

        {signaturePlan && (
          <div className="rounded-md border border-meewind-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{signaturePlan.signatureRoute.name}</span>
              <span className="text-xs text-meewind-fg-muted">
                {LANDSCAPE_EMOJI[signaturePlan.signatureRoute.landscapeType]}{" "}
                {landscapeLabels[signaturePlan.signatureRoute.landscapeType]}
              </span>
            </div>
            <p className="text-xs text-meewind-fg-muted mt-1">
              {signaturePlan.signatureRoute.description}
            </p>
            <p className="text-xs text-meewind-fg-muted mt-1">
              {signaturePlan.usedStation
                ? t("home.signatureStationHint", { station: signaturePlan.station?.name ?? "" })
                : t("home.signatureDirectHint")}
            </p>
          </div>
        )}

        {route && (
          <RouteSummary route={route} pois={pois} onRoadTypeSegments={setRoadTypeSegments} />
        )}

        {scenicPlan && (
          <>
            <TrainReturnPanel
              home={start ?? scenicPlan.entryStation}
              dest={scenicPlan.entryStation}
              date={date}
              title={t("home.scenicOutboundTitle")}
              preloaded={scenicPlan.outboundTrain}
            />
            <TrainReturnPanel
              home={start ?? scenicPlan.entryStation}
              dest={scenicPlan.exitStation}
              date={date}
              title={t("home.scenicReturnTitle")}
              preloaded={scenicPlan.returnTrain}
            />
          </>
        )}

        {signaturePlan?.usedStation && signaturePlan.station && signaturePlan.outboundTrain && (
          <>
            <TrainReturnPanel
              home={start ?? signaturePlan.station}
              dest={signaturePlan.station}
              date={date}
              title={t("home.signatureOutboundTitle")}
              preloaded={signaturePlan.outboundTrain}
            />
            <TrainReturnPanel
              home={start ?? signaturePlan.station}
              dest={signaturePlan.station}
              date={date}
              title={t("home.signatureReturnTitle")}
              preloaded={signaturePlan.returnTrain ?? undefined}
            />
          </>
        )}

        {!scenicPlan && route && mode === "oneway" && start && destination && (
          <TrainReturnPanel home={start} dest={destination} date={date} />
        )}
      </aside>

      <main className="order-1 md:order-2 flex-1 h-[50vh] md:h-screen">
        <RouteMap
          start={mapStart}
          onSetStart={handleSetStart}
          legs={route?.legs ?? []}
          pois={pois}
          wind={route?.windInfo ?? null}
          roadTypeSegments={route ? roadTypeSegments : []}
          destination={mapDestination}
          homeMarker={mapHomeMarker}
          labels={{
            start: tMap("start"),
            home: tMap("home"),
            destination: tMap("destination"),
          }}
        />
      </main>
    </div>
  );
}
