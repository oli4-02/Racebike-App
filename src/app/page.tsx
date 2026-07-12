"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import OneWayTargetPicker, { type OneWaySubMode } from "@/components/OneWayTargetPicker";
import PlannerForm, { type AppMode } from "@/components/PlannerForm";
import RouteSummary from "@/components/RouteSummary";
import SignatureRoutePicker from "@/components/SignatureRoutePicker";
import TrainReturnPanel from "@/components/TrainReturnPanel";
import { fetchPois, planRoute } from "@/lib/apiClient";
import { LANDSCAPE_EMOJI, LANDSCAPE_LABELS } from "@/lib/scenicCorridors";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type {
  LatLon,
  PlannedRoute,
  POI,
  POICategory,
  Priorities,
  RouteMode,
  ScenicRoutePlan,
  SignatureRoutePlan,
} from "@/lib/types";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      Karte wird geladen…
    </div>
  ),
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Home() {
  const [start, setStart] = useState<LatLon | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("roundtrip");
  const [distanceKm, setDistanceKm] = useState(60);
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

  // The core planner only knows roundtrip/oneway; "signature" is a UI-level
  // mode that always resolves to a roundtrip plan via its own endpoint.
  const mode: RouteMode = appMode === "oneway" ? "oneway" : "roundtrip";

  const canSubmit =
    appMode !== "signature" && Boolean(start) && (mode === "roundtrip" || Boolean(destination));
  const submitHint = !start
    ? "Startpunkt per Adresssuche oder Klick auf die Karte wählen."
    : mode === "oneway" && !destination
      ? "Bitte zuerst ein Ziel wählen (Adresse eingeben oder Vorschlag auswählen)."
      : null;

  async function loadPois(geometry: LatLon[]) {
    if (poiCategories.length === 0) return;
    try {
      const p = await fetchPois(geometry, poiCategories);
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
    try {
      const planned = await planRoute({
        start,
        mode,
        distanceKm,
        date,
        priorities,
        destination: mode === "oneway" ? destination! : undefined,
      });
      setRoute(planned);
      await loadPois(planned.geometry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Routenplanung fehlgeschlagen.");
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleScenicRoute(result: ScenicRoutePlan) {
    setError(null);
    setDestination(null);
    setDestinationLabel(null);
    setSignaturePlan(null);
    setScenicPlan(result);
    setRoute(result.route);
    setPois([]);
    await loadPois(result.route.geometry);
  }

  async function handleSignatureRoute(result: SignatureRoutePlan) {
    setError(null);
    setDestination(null);
    setDestinationLabel(null);
    setScenicPlan(null);
    setSignaturePlan(result);
    setRoute(result.route);
    setPois([]);
    await loadPois(result.route.geometry);
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
      <aside className="order-2 md:order-1 flex flex-col gap-4 overflow-y-auto p-4 md:w-96 md:h-screen border-t md:border-t-0 md:border-r border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold">Rennrad-Routenplaner NL</h1>
          <p className="text-xs text-zinc-500">
            Startpunkt wählen, Distanz einstellen, Route entlang des
            Fietsknooppuntennetzes planen.
          </p>
        </div>

        <AddressSearch onSelect={handleSetStart} />

        {appMode === "oneway" && start && (
          <OneWayTargetPicker
            start={start}
            distanceKm={distanceKm}
            date={date}
            priorities={priorities}
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

        {appMode === "signature" && start && (
          <SignatureRoutePicker
            start={start}
            distanceKm={distanceKm}
            date={date}
            priorities={priorities}
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
          onSubmit={handleSubmit}
          loading={loading}
          canSubmit={canSubmit}
          submitHint={submitHint}
          oneWaySubMode={appMode === "oneway" ? oneWaySubMode : undefined}
        />

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
            {error}
          </div>
        )}

        {scenicPlan && (
          <div className="rounded-md border border-zinc-300 dark:border-zinc-700 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{scenicPlan.corridor.name}</span>
              <span className="text-xs text-zinc-500">
                {LANDSCAPE_EMOJI[scenicPlan.corridor.landscapeType]}{" "}
                {LANDSCAPE_LABELS[scenicPlan.corridor.landscapeType]}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              {scenicPlan.corridor.description}
            </p>
          </div>
        )}

        {signaturePlan && (
          <div className="rounded-md border border-zinc-300 dark:border-zinc-700 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{signaturePlan.signatureRoute.name}</span>
              <span className="text-xs text-zinc-500">
                {LANDSCAPE_EMOJI[signaturePlan.signatureRoute.landscapeType]}{" "}
                {LANDSCAPE_LABELS[signaturePlan.signatureRoute.landscapeType]}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              {signaturePlan.signatureRoute.description}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {signaturePlan.usedStation
                ? `Start liegt weit entfernt — Anreise per Zug nach ${signaturePlan.station?.name}.`
                : "Start liegt in der Nähe — direkt von Zuhause losfahren."}
            </p>
          </div>
        )}

        {route && <RouteSummary route={route} pois={pois} />}

        {scenicPlan && (
          <>
            <TrainReturnPanel
              home={start ?? scenicPlan.entryStation}
              dest={scenicPlan.entryStation}
              date={date}
              title="Hinfahrt (Zuhause → Einstieg)"
              preloaded={scenicPlan.outboundTrain}
            />
            <TrainReturnPanel
              home={start ?? scenicPlan.entryStation}
              dest={scenicPlan.exitStation}
              date={date}
              title="Rückfahrt (Ausstieg → Zuhause)"
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
              title="Hinfahrt (Zuhause → Start der Route)"
              preloaded={signaturePlan.outboundTrain}
            />
            <TrainReturnPanel
              home={start ?? signaturePlan.station}
              dest={signaturePlan.station}
              date={date}
              title="Rückfahrt (Ende der Route → Zuhause)"
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
          destination={mapDestination}
          homeMarker={mapHomeMarker}
        />
      </main>
    </div>
  );
}
