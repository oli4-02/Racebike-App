"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import PlannerForm from "@/components/PlannerForm";
import RouteSummary from "@/components/RouteSummary";
import TrainReturnPanel from "@/components/TrainReturnPanel";
import { fetchPois, planRoute } from "@/lib/apiClient";
import type { LatLon, PlannedRoute, POI, POICategory, RouteMode } from "@/lib/types";

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
  const [mode, setMode] = useState<RouteMode>("roundtrip");
  const [distanceKm, setDistanceKm] = useState(60);
  const [date, setDate] = useState(today());
  const [bearingDeg, setBearingDeg] = useState(90);
  const [poiCategories, setPoiCategories] = useState<POICategory[]>([
    "fuel",
    "supermarket",
    "ice_cream",
    "cafe",
  ]);

  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!start) return;
    setLoading(true);
    setError(null);
    setPois([]);
    try {
      const planned = await planRoute({
        start,
        mode,
        distanceKm,
        date,
        bearingDeg: mode === "oneway" ? bearingDeg : undefined,
      });
      setRoute(planned);

      if (poiCategories.length > 0) {
        try {
          const p = await fetchPois(planned.geometry, poiCategories);
          setPois(p);
        } catch {
          // POIs are a nice-to-have; a failed lookup shouldn't block the route.
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Routenplanung fehlgeschlagen.");
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }

  const destination =
    route && route.mode === "oneway" ? route.geometry[route.geometry.length - 1] : null;

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

        <AddressSearch onSelect={(p) => setStart(p)} />

        <PlannerForm
          mode={mode}
          setMode={setMode}
          distanceKm={distanceKm}
          setDistanceKm={setDistanceKm}
          date={date}
          setDate={setDate}
          bearingDeg={bearingDeg}
          setBearingDeg={setBearingDeg}
          poiCategories={poiCategories}
          setPoiCategories={setPoiCategories}
          onSubmit={handleSubmit}
          loading={loading}
          hasStart={Boolean(start)}
        />

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {route && <RouteSummary route={route} pois={pois} />}

        {route && mode === "oneway" && start && destination && (
          <TrainReturnPanel home={start} dest={destination} date={date} />
        )}
      </aside>

      <main className="order-1 md:order-2 flex-1 h-[50vh] md:h-screen">
        <RouteMap
          start={start}
          onSetStart={(p) => setStart(p)}
          geometry={route?.geometry ?? []}
          pois={pois}
        />
      </main>
    </div>
  );
}
