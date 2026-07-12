import type { LatLon } from "./types";

// Public OSRM demo instance with a bicycle routing profile.
// Note: OSRM's HTTP API requires a "profile" path segment, but the
// routing.openstreetmap.de demo servers are dedicated per-mode instances
// (routed-bike, routed-car, routed-foot) where that segment is a fixed
// label rather than a live profile switch — "driving" is the documented
// placeholder to use here regardless of the actual (bike) backend.
const OSRM_BASE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";

const OSRM_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "racebike-app/0.1 (personal cycling route planner; https://github.com/oli4-02/Racebike-App)",
};

export type OsrmLeg = {
  distanceM: number;
  durationS: number;
  geometry: LatLon[];
};

/** Routes a single leg between two points, following the paved cycling network. */
export async function routeLeg(a: LatLon, b: LatLon): Promise<OsrmLeg> {
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url, {
    headers: OSRM_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const bodySnippet = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `OSRM antwortete HTTP ${res.status} ${res.statusText}${
        bodySnippet ? `: ${bodySnippet}` : ""
      }`
    );
  }
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`OSRM konnte keine Route finden: ${data.code ?? "unknown"}`);
  }

  const route = data.routes[0];
  const geometry: LatLon[] = route.geometry.coordinates.map(
    ([lon, lat]: [number, number]) => ({ lat, lon })
  );

  return {
    distanceM: route.distance,
    durationS: route.duration,
    geometry,
  };
}

/** Routes a full chain of waypoints leg by leg (sequential to stay polite with the free instance). */
export async function routeChain(points: LatLon[]): Promise<OsrmLeg[]> {
  const legs: OsrmLeg[] = [];
  for (let i = 1; i < points.length; i++) {
    legs.push(await routeLeg(points[i - 1], points[i]));
  }
  return legs;
}
