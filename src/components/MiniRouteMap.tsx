"use client";

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import { destinationIcon } from "@/lib/leafletIcons";
import type { LatLon } from "@/lib/types";

/** Small non-interactive preview map for a suggestion card: start marker, destination marker, preview route. */
export default function MiniRouteMap({
  start,
  destination,
  geometry,
}: {
  start: LatLon;
  destination: LatLon;
  geometry: LatLon[];
}) {
  // Bounds from geometry too, not just start/destination: for a loop preview
  // (signature routes) start and destination are the same point, so bounds
  // from those alone would collapse to zero area and zoom in on nothing.
  const bounds: [number, number][] = [
    [start.lat, start.lon],
    [destination.lat, destination.lon],
    ...geometry.map((p): [number, number] => [p.lat, p.lon]),
  ];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [16, 16] }}
      className="h-28 w-full rounded"
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[start.lat, start.lon]} />
      <Marker position={[destination.lat, destination.lon]} icon={destinationIcon} />
      {geometry.length > 1 && (
        <Polyline
          positions={geometry.map((p) => [p.lat, p.lon])}
          color="#2563eb"
          weight={3}
        />
      )}
    </MapContainer>
  );
}
