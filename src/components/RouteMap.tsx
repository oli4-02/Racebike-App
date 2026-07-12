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
import type { LatLon, POI } from "@/lib/types";

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

export default function RouteMap({
  start,
  onSetStart,
  geometry,
  pois,
}: {
  start: LatLon | null;
  onSetStart: (p: LatLon) => void;
  geometry: LatLon[];
  pois: POI[];
}) {
  const center = useMemo<[number, number]>(
    () => (start ? [start.lat, start.lon] : [52.09, 5.12]),
    [start]
  );

  const polylinePositions = useMemo<[number, number][]>(
    () => geometry.map((p) => [p.lat, p.lon]),
    [geometry]
  );

  return (
    <MapContainer
      center={center}
      zoom={8}
      className="h-full w-full"
      scrollWheelZoom
    >
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
      {polylinePositions.length > 1 && (
        <Polyline positions={polylinePositions} color="#2563eb" weight={4} />
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
  );
}
