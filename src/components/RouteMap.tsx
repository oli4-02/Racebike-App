"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { bearing } from "@/lib/geo";
import { tailwindColor, tailwindComponent } from "@/lib/wind";
import type { LatLon, POI, RouteLeg } from "@/lib/types";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

const poiIcons: Record<POI["category"], L.DivIcon> = {
  fuel: divIcon("#e11d48", "⛽"),
  supermarket: divIcon("#2563eb", "🛒"),
  ice_cream: divIcon("#db2777", "🍦"),
  cafe: divIcon("#7c3aed", "☕"),
};

const destinationIcon = divIcon("#16a34a", "🏁");

function divIcon(color: string, emoji: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 3px rgba(0,0,0,.4)">${emoji}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

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

export default function RouteMap({
  start,
  onSetStart,
  legs,
  pois,
  wind = null,
  destination = null,
}: {
  start: LatLon | null;
  onSetStart: (p: LatLon) => void;
  legs: RouteLeg[];
  pois: POI[];
  wind?: { directionDeg: number; speedKmh: number } | null;
  destination?: LatLon | null;
}) {
  const center = useMemo<[number, number]>(
    () => (start ? [start.lat, start.lon] : [52.09, 5.12]),
    [start]
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={onSetStart} />
        <RecenterOnStart start={start} />
        {start && (
          <Marker position={[start.lat, start.lon]}>
            <Popup>Start</Popup>
          </Marker>
        )}
        <LegPolylines legs={legs} wind={wind} />
        {destination && (
          <Marker position={[destination.lat, destination.lon]} icon={destinationIcon}>
            <Popup>Ziel</Popup>
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
      <WindCompassOverlay wind={wind} />
    </div>
  );
}
