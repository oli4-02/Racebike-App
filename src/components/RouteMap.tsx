"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Circle,
  Popup,
  ZoomControl,
  useMapEvents,
  useMap,
} from "react-leaflet";
import type L from "leaflet";
import { bearing, destinationPoint } from "@/lib/geo";
import { tailwindColor, tailwindComponent } from "@/lib/wind";
import { destinationIcon, divIcon, homeIcon } from "@/lib/leafletIcons";
import type { LatLon, POI, RoadTypeBreakdown, RoadTypeSegment, RouteLeg } from "@/lib/types";

const ROAD_TYPE_COLORS: Record<keyof RoadTypeBreakdown, string> = {
  cyclewayPct: "#16a34a",
  residentialPct: "#f59e0b",
  mainRoadPct: "#dc2626",
  otherPct: "#6b7280",
};

const poiIcons: Record<POI["category"], L.DivIcon> = {
  fuel: divIcon("#e11d48", "⛽"),
  supermarket: divIcon("#2563eb", "🛒"),
  ice_cream: divIcon("#db2777", "🍦"),
  cafe: divIcon("#7c3aed", "☕"),
};

function ClickHandler({ onClick }: { onClick: (p: LatLon) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

function RecenterOnStart({ start }: { start: LatLon | null }) {
  const map = useMap();
  useEffect(() => {
    if (start) map.setView([start.lat, start.lon], map.getZoom() < 11 ? 12 : map.getZoom());
  }, [start, map]);
  return null;
}

function WindCompassOverlay({
  wind,
}: {
  wind: { directionDeg: number; speedKmh: number } | null;
}) {
  if (!wind) return null;
  // Arrow points where the wind blows TO, i.e. the way it would push a rider.
  const towardsDeg = (wind.directionDeg + 180) % 360;

  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col items-center gap-0.5 rounded-full bg-white/90 dark:bg-zinc-900/90 shadow-md w-16 h-16 justify-center pointer-events-none">
      <div
        style={{ transform: `rotate(${towardsDeg}deg)` }}
        className="text-2xl leading-none text-zinc-800 dark:text-zinc-100"
      >
        ↑
      </div>
      <div className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
        {wind.speedKmh.toFixed(0)} km/h
      </div>
    </div>
  );
}

/** Colors each leg by tailwind (green) vs. headwind (red) using its overall chord bearing. */
function LegPolylines({
  legs,
  wind,
}: {
  legs: RouteLeg[];
  wind: { directionDeg: number; speedKmh: number } | null;
}) {
  return (
    <>
      {legs.map((leg, i) => {
        const positions: [number, number][] = leg.geometry.map((p) => [p.lat, p.lon]);
        if (positions.length < 2) return null;

        const color = wind
          ? tailwindColor(
              tailwindComponent(bearing(leg.from, leg.to), wind.directionDeg)
            )
          : "#2563eb";

        return <Polyline key={i} positions={positions} color={color} weight={5} />;
      })}
    </>
  );
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export type PlanPreview = {
  mode: "roundtrip" | "oneway";
  distanceKm: number;
  direction: number | null;
};

// Mirrors the out-and-back/full-loop radius formulas and directional cone
// width in routePlanner.ts -- duplicated here (rather than imported) since
// that module pulls in server-side route-planning code this client preview
// has no business bundling, but the two should stay in visual agreement.
const ROUNDTRIP_DETOUR_FACTOR = 1.3;
const DIRECTIONAL_CONE_HALF_WIDTH = 75;

function roundTripPreviewRadiusM(distanceKm: number, hasDirection: boolean): number {
  const targetM = distanceKm * 1000;
  return hasDirection
    ? targetM / (2 * ROUNDTRIP_DETOUR_FACTOR)
    : targetM / (2 * Math.PI * ROUNDTRIP_DETOUR_FACTOR);
}

function sectorPositions(start: LatLon, direction: number, radiusM: number): [number, number][] {
  const steps = 24;
  const points: [number, number][] = [[start.lat, start.lon]];
  for (let i = 0; i <= steps; i++) {
    const b = direction - DIRECTIONAL_CONE_HALF_WIDTH + (2 * DIRECTIONAL_CONE_HALF_WIDTH * i) / steps;
    const p = destinationPoint(start, b, radiusM);
    points.push([p.lat, p.lon]);
  }
  points.push([start.lat, start.lon]);
  return points;
}

/**
 * Rough, purely client-side geometric preview of what a plan would search --
 * shown as soon as a start point exists, before the user ever presses "plan
 * route", so the app doesn't read as a blackbox that only reacts once
 * submitted. Debounced so dragging a slider doesn't reshape the map on every
 * tick. Not the real route (that still needs a server round trip) -- just
 * the rough shape/reach the planner will search within.
 */
function LivePreviewOverlay({ start, preview }: { start: LatLon; preview: PlanPreview }) {
  const debounced = useDebounced(preview, 250);

  if (debounced.mode === "oneway") {
    return (
      <Circle
        center={[start.lat, start.lon]}
        radius={debounced.distanceKm * 1000}
        pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.08, dashArray: "6 6" }}
      />
    );
  }

  const hasDirection = debounced.direction !== null;
  const radiusM = roundTripPreviewRadiusM(debounced.distanceKm, hasDirection);

  if (!hasDirection) {
    return (
      <Circle
        center={[start.lat, start.lon]}
        radius={radiusM}
        pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.08, dashArray: "6 6" }}
      />
    );
  }

  return (
    <Polygon
      positions={sectorPositions(start, debounced.direction!, radiusM)}
      pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.1, dashArray: "6 6" }}
    />
  );
}

/** Colors each stretch of the route by its OSM road type (cycleway/residential/main road/other). */
function RoadTypePolylines({ segments }: { segments: RoadTypeSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        const positions: [number, number][] = seg.points.map((p) => [p.lat, p.lon]);
        if (positions.length < 2) return null;
        return <Polyline key={i} positions={positions} color={ROAD_TYPE_COLORS[seg.type]} weight={5} />;
      })}
    </>
  );
}

function ColorModeToggle({
  mode,
  onChange,
}: {
  mode: "wind" | "roadType";
  onChange: (mode: "wind" | "roadType") => void;
}) {
  const t = useTranslations("planner.map");
  return (
    <div className="absolute top-[92px] right-3 z-[1000] flex rounded-md overflow-hidden border border-meewind-border bg-white/90 dark:bg-zinc-900/90 text-xs shadow-md">
      <button
        type="button"
        onClick={() => onChange("wind")}
        className={`px-2 py-1 ${mode === "wind" ? "bg-meewind-accent text-meewind-accent-fg" : ""}`}
      >
        {t("colorByWind")}
      </button>
      <button
        type="button"
        onClick={() => onChange("roadType")}
        className={`px-2 py-1 ${mode === "roadType" ? "bg-meewind-accent text-meewind-accent-fg" : ""}`}
      >
        {t("colorByRoadType")}
      </button>
    </div>
  );
}

export default function RouteMap({
  start,
  onSetStart,
  legs,
  pois,
  wind = null,
  roadTypeSegments = [],
  preview = null,
  destination = null,
  homeMarker = null,
  labels = { start: "Start", home: "Home", destination: "Destination" },
}: {
  start: LatLon | null;
  onSetStart: (p: LatLon) => void;
  legs: RouteLeg[];
  pois: POI[];
  wind?: { directionDeg: number; speedKmh: number } | null;
  roadTypeSegments?: RoadTypeSegment[];
  /** Rough live search-area indicator shown before a route is computed (see LivePreviewOverlay); null hides it (e.g. once a real route exists). */
  preview?: PlanPreview | null;
  destination?: LatLon | null;
  /** Shown as a distinct house icon; used in scenic-route mode where `start` is the corridor entry station, not the rider's actual home. */
  homeMarker?: LatLon | null;
  labels?: { start: string; home: string; destination: string };
}) {
  const center = useMemo<[number, number]>(
    () => (start ? [start.lat, start.lon] : [52.09, 5.12]),
    [start]
  );
  const [colorMode, setColorMode] = useState<"wind" | "roadType">("wind");
  const showRoadType = colorMode === "roadType" && roadTypeSegments.length > 0;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={8}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={onSetStart} />
        <RecenterOnStart start={start} />
        {start && preview && <LivePreviewOverlay start={start} preview={preview} />}
        {start && (
          <Marker position={[start.lat, start.lon]}>
            <Popup>{labels.start}</Popup>
          </Marker>
        )}
        {showRoadType ? (
          <RoadTypePolylines segments={roadTypeSegments} />
        ) : (
          <LegPolylines legs={legs} wind={wind} />
        )}
        {homeMarker && (
          <Marker position={[homeMarker.lat, homeMarker.lon]} icon={homeIcon}>
            <Popup>{labels.home}</Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lon]} icon={destinationIcon}>
            <Popup>{labels.destination}</Popup>
          </Marker>
        )}
        {pois.map((poi) => (
          <Marker
            key={`${poi.category}-${poi.id}`}
            position={[poi.lat, poi.lon]}
            icon={poiIcons[poi.category]}
          >
            <Popup>{poi.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
      {roadTypeSegments.length > 0 && <ColorModeToggle mode={colorMode} onChange={setColorMode} />}
      <WindCompassOverlay wind={showRoadType ? null : wind} />
    </div>
  );
}
